import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
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
  try {
    const ref = collection(db, COLLECTIONS.CENTRAL_RECEIPTS);
    let q = query(ref, where("eventId", "==", eventId));
    if (classId) {
      q = query(ref, where("eventId", "==", eventId), where("classId", "==", classId));
    }
    const snap = await getDocs(q);
    const list: CentralReceiptModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<CentralReceiptModel, "id">) });
    });
    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  } catch (error) {
    console.error(`Error fetching central receipts for event ${eventId}:`, error);
    return [];
  }
}
