import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import { auth } from "../firebase/auth";
import { COLLECTIONS } from "../firebase/collections";
import type { CentralReceiptModel, UserProfile } from "../types";
import { logAudit } from "./auditService";

export interface CreateCentralReceiptParams {
  eventId: string;
  classId: string;
  totalAmount: number;
  cashAmount: number;
  digitalAmount: number;
  otherAmount: number;
  date: string;
  time?: string;
  remarks?: string;
  assignmentId?: string;
}

export async function createCentralReceipt(
  params: CreateCentralReceiptParams,
  user: UserProfile,
  actorRoleTitle?: string
): Promise<CentralReceiptModel> {
  const sum = (params.cashAmount || 0) + (params.digitalAmount || 0) + (params.otherAmount || 0);
  if (sum !== params.totalAmount) {
    throw new Error(
      `Discrepancy: Cash (₹${params.cashAmount}) + Digital (₹${params.digitalAmount}) + Other (₹${params.otherAmount}) = ₹${sum}, which does not match Total Amount (₹${params.totalAmount})`
    );
  }

  // 1. Attempt secure Vercel API with Firebase ID token
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      const response = await fetch("/api/create-central-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.receipt) {
          return result.receipt as CentralReceiptModel;
        }
      } else if (response.status === 403 || response.status === 401 || response.status === 400) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server authorization error (${response.status})`);
      }
    }
  } catch (apiErr: any) {
    // If it was an explicit authorization or validation error, rethrow immediately
    if (
      apiErr.message?.includes("Access Denied") ||
      apiErr.message?.includes("Discrepancy") ||
      apiErr.message?.includes("Total amount") ||
      apiErr.message?.includes("authorization error")
    ) {
      throw apiErr;
    }
    console.warn("[receiptService] create-central-receipt API fallback:", apiErr.message);
  }

  // 2. Direct Firestore fallback (enforced by firestore.rules)
  const roleTitle =
    actorRoleTitle ||
    (user.role === "super_coordinator"
      ? "Super Coordinator"
      : user.role === "class_coordinator"
      ? "Class Coordinator"
      : "Cross-Class Collection Assistant");

  const ref = collection(db, COLLECTIONS.CENTRAL_RECEIPTS);
  const now = serverTimestamp();

  const data: Record<string, any> = {
    eventId: params.eventId,
    classId: params.classId,
    totalAmount: params.totalAmount,
    cashAmount: params.cashAmount || 0,
    digitalAmount: params.digitalAmount || 0,
    otherAmount: params.otherAmount || 0,
    date: params.date,
    time: params.time || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    receivedBy: user.uid,
    receivedByName: user.name,
    receivedByRole: roleTitle,
    remarks: params.remarks?.trim() || "",
    createdAt: now,
    updatedAt: now,
  };

  if (params.assignmentId) {
    data.assignmentId = params.assignmentId;
  }

  const docRef = await addDoc(ref, data);

  await logAudit({
    userId: user.uid,
    userRole: roleTitle,
    userName: user.name,
    action: "CENTRAL_RECEIPT_CREATED",
    category: "central_receipt",
    eventId: params.eventId,
    classId: params.classId,
    receiptId: docRef.id,
    amount: params.totalAmount,
    description: `Recorded central receipt of ₹${params.totalAmount} (Cash: ₹${params.cashAmount}, Digital: ₹${params.digitalAmount}) by ${roleTitle}`,
  });

  return {
    id: docRef.id,
    ...data,
  } as CentralReceiptModel;
}

export async function fetchCentralReceipts(
  eventId: string,
  classId?: string
): Promise<CentralReceiptModel[]> {
  // 1. Attempt secure Vercel API with ID token
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      const url = new URL("/api/get-central-receipts", window.location.origin);
      url.searchParams.set("eventId", eventId);
      if (classId && classId !== "all") {
        url.searchParams.set("classId", classId);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.receipts)) {
          return result.receipts as CentralReceiptModel[];
        }
      } else if (response.status === 403 || response.status === 401) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Access Denied: You do not have permission to view Central Receipts.");
      }
    }
  } catch (apiErr: any) {
    if (apiErr.message?.includes("Access Denied")) {
      throw apiErr;
    }
    console.warn("[receiptService] get-central-receipts API fallback:", apiErr.message);
  }

  // 2. Direct Firestore fallback
  try {
    const ref = collection(db, COLLECTIONS.CENTRAL_RECEIPTS);
    let q = query(ref, where("eventId", "==", eventId));
    if (classId && classId !== "all") {
      q = query(ref, where("eventId", "==", eventId), where("classId", "==", classId));
    }
    const snap = await getDocs(q);
    const list: CentralReceiptModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<CentralReceiptModel, "id">) });
    });
    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  } catch (error: any) {
    console.error(`Error fetching central receipts for event ${eventId}:`, error);
    throw error;
  }
}
