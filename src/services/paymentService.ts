import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import { COLLECTIONS } from "../firebase/collections";
import type {
  PaymentModel,
  PaymentMethod,
  PaymentStatus,
  UserProfile,
} from "../types";
import { logAudit } from "./auditService";

export interface AddPaymentParams {
  eventId: string;
  participantId: string;
  studentId: string;
  classId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  autoApprove?: boolean;
}

export async function addPayment(
  params: AddPaymentParams,
  user: UserProfile
): Promise<PaymentModel> {
  if (params.amount <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  const isSuper = user.role === "super_coordinator";
  const shouldApprove = isSuper && (params.autoApprove ?? true);
  const status: PaymentStatus = shouldApprove ? "approved" : "pending_approval";

  const ref = collection(db, COLLECTIONS.PAYMENTS);
  const now = serverTimestamp();

  const data: Record<string, any> = {
    eventId: params.eventId,
    participantId: params.participantId,
    studentId: params.studentId,
    classId: params.classId,
    amount: Number(params.amount),
    paymentMethod: params.paymentMethod,
    paymentReference: params.paymentReference?.trim() || "",
    status,
    addedBy: user.uid,
    addedByName: user.name,
    addedAt: now,
    updatedAt: now,
  };

  if (shouldApprove) {
    data.approvedBy = user.uid;
    data.approvedByName = user.name;
    data.approvedAt = now;
  }

  const docRef = await addDoc(ref, data);

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: shouldApprove ? "add_and_approve_payment" : "submit_payment",
    category: "fund_collection",
    eventId: params.eventId,
    classId: params.classId,
    studentId: params.studentId,
    paymentId: docRef.id,
    amount: params.amount,
    description: `Added payment of ₹${params.amount} via ${params.paymentMethod} (${status})`,
  });

  return {
    id: docRef.id,
    ...data,
  } as PaymentModel;
}

export async function approvePayment(
  paymentId: string,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  const now = serverTimestamp();

  await updateDoc(ref, {
    status: "approved" as PaymentStatus,
    approvedBy: user.uid,
    approvedByName: user.name,
    approvedAt: now,
    updatedAt: now,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "approve_payment",
    category: "fund_approval",
    paymentId,
    description: `Approved payment ${paymentId}`,
  });
}

export async function batchApprovePayments(
  payments: PaymentModel[],
  user: UserProfile
): Promise<void> {
  if (payments.length === 0) return;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  for (const p of payments) {
    const ref = doc(db, COLLECTIONS.PAYMENTS, p.id);
    batch.update(ref, {
      status: "approved" as PaymentStatus,
      approvedBy: user.uid,
      approvedByName: user.name,
      approvedAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();

  const totalAmount = payments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "batch_approve_payments",
    category: "fund_approval",
    eventId: payments[0]?.eventId,
    amount: totalAmount,
    description: `Batch approved ${payments.length} payments totaling ₹${totalAmount}`,
  });
}

export async function declinePayment(
  paymentId: string,
  reason: string,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  const now = serverTimestamp();

  await updateDoc(ref, {
    status: "declined" as PaymentStatus,
    declinedBy: user.uid,
    declinedByName: user.name,
    declinedAt: now,
    updatedAt: now,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "decline_payment",
    category: "fund_approval",
    paymentId,
    description: `Declined payment ${paymentId}. Reason: ${reason || "None specified"}`,
  });
}

export async function rollbackPayment(
  paymentId: string,
  reason: string,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  const now = serverTimestamp();

  await updateDoc(ref, {
    status: "rolled_back" as PaymentStatus,
    rolledBackBy: user.uid,
    rolledBackByName: user.name,
    rolledBackAt: now,
    updatedAt: now,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "rollback_payment",
    category: "payment_rollback",
    paymentId,
    description: `Rolled back approved payment ${paymentId}. Reason: ${reason || "None specified"}`,
  });
}

export async function fetchPayments(
  eventId: string,
  classId?: string
): Promise<PaymentModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.PAYMENTS);
    let q = query(ref, where("eventId", "==", eventId));
    if (classId) {
      q = query(ref, where("eventId", "==", eventId), where("classId", "==", classId));
    }
    const snap = await getDocs(q);
    const list: PaymentModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<PaymentModel, "id">) });
    });
    return list.sort((a, b) => {
      const timeA = a.addedAt?.seconds ? a.addedAt.seconds * 1000 : new Date(a.addedAt || 0).getTime();
      const timeB = b.addedAt?.seconds ? b.addedAt.seconds * 1000 : new Date(b.addedAt || 0).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    console.error(`Error fetching payments for event ${eventId}:`, error);
    return [];
  }
}

export async function fetchPaymentsByStudent(
  studentId: string
): Promise<PaymentModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.PAYMENTS);
    const q = query(ref, where("studentId", "==", studentId));
    const snap = await getDocs(q);
    const list: PaymentModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<PaymentModel, "id">) });
    });
    return list;
  } catch (error) {
    console.error(`Error fetching payments for student ${studentId}:`, error);
    return [];
  }
}
