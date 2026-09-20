import {
  collection,
  doc,
  getDoc,
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
    userRole: user.role === "super_coordinator" ? "Super Coordinator" : user.role === "class_coordinator" ? "Class Coordinator" : "Cross-Class Collection Assistant",
    userName: user.name,
    action: shouldApprove ? "add_and_approve_payment" : "submit_payment",
    category: "fund_collection",
    eventId: params.eventId,
    classId: params.classId,
    studentId: params.studentId,
    paymentId: docRef.id,
    amount: params.amount,
    description: `Logged payment of ₹${params.amount} via ${params.paymentMethod} (${status})`,
  });

  return {
    id: docRef.id,
    ...data,
  } as PaymentModel;
}

export async function approvePayment(
  paymentId: string,
  user: UserProfile,
  actorRoleTitle?: string
): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  const snap = await getDoc(ref);
  const paymentData = snap.data() as PaymentModel | undefined;
  const now = serverTimestamp();

  await updateDoc(ref, {
    status: "approved" as PaymentStatus,
    approvedBy: user.uid,
    approvedByName: user.name,
    approvedAt: now,
    updatedAt: now,
  });

  const roleToLog =
    actorRoleTitle ||
    (user.role === "super_coordinator"
      ? "Super Coordinator"
      : user.role === "class_coordinator"
      ? "Class Coordinator"
      : "Cross-Class Collection Assistant");

  await logAudit({
    userId: user.uid,
    userRole: roleToLog,
    userName: user.name,
    action: "payment_approved",
    category: "fund_approval",
    eventId: paymentData?.eventId,
    classId: paymentData?.classId,
    studentId: paymentData?.studentId,
    paymentId,
    amount: paymentData?.amount,
    description: `Approved payment of ₹${paymentData?.amount || 0} (${roleToLog})`,
  });
}

export async function batchApprovePayments(
  payments: PaymentModel[],
  user: UserProfile,
  actorRoleTitle?: string
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
  const roleToLog =
    actorRoleTitle ||
    (user.role === "super_coordinator"
      ? "Super Coordinator"
      : "Cross-Class Collection Assistant");

  await logAudit({
    userId: user.uid,
    userRole: roleToLog,
    userName: user.name,
    action: "batch_approve_payments",
    category: "fund_approval",
    eventId: payments[0]?.eventId,
    amount: totalAmount,
    description: `Batch approved ${payments.length} payments totaling ₹${totalAmount} (${roleToLog})`,
    metadata: {
      paymentIds: payments.map((p) => p.id),
      classIds: Array.from(new Set(payments.map((p) => p.classId))),
    },
  });
}

export async function declinePayment(
  paymentId: string,
  reason: string,
  user: UserProfile,
  actorRoleTitle?: string
): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  const snap = await getDoc(ref);
  const paymentData = snap.data() as PaymentModel | undefined;
  const now = serverTimestamp();

  await updateDoc(ref, {
    status: "declined" as PaymentStatus,
    declinedBy: user.uid,
    declinedByName: user.name,
    declinedAt: now,
    updatedAt: now,
  });

  const roleToLog =
    actorRoleTitle ||
    (user.role === "super_coordinator"
      ? "Super Coordinator"
      : user.role === "class_coordinator"
      ? "Class Coordinator"
      : "Cross-Class Collection Assistant");

  await logAudit({
    userId: user.uid,
    userRole: roleToLog,
    userName: user.name,
    action: "decline_payment",
    category: "fund_approval",
    eventId: paymentData?.eventId,
    classId: paymentData?.classId,
    studentId: paymentData?.studentId,
    paymentId,
    amount: paymentData?.amount,
    description: `Declined payment of ₹${paymentData?.amount || 0}. Reason: ${reason || "None specified"} (${roleToLog})`,
  });
}

const activePaymentRollbackLocks = new Set<string>();

export async function rollbackPayment(
  paymentId: string,
  reason: string,
  user: UserProfile
): Promise<void> {
  if (user.role !== "super_coordinator" || user.active === false || user.loginEnabled === false) {
    throw new Error("Unauthorized: Only an active Super Coordinator can rollback a payment.");
  }

  if (activePaymentRollbackLocks.has(paymentId)) {
    throw new Error("A rollback request for this payment is already being processed.");
  }

  activePaymentRollbackLocks.add(paymentId);
  try {
    const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error("Payment record not found.");
    }
    const paymentData = snap.data() as PaymentModel | undefined;
    if (!paymentData) {
      throw new Error("Payment record data is invalid.");
    }
    if (paymentData.status === "rolled_back") {
      throw new Error("This payment has already been rolled back.");
    }

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
      userRole: user.role === "super_coordinator" ? "Super Coordinator" : user.role,
      userName: user.name,
      action: "rollback_payment",
      category: "payment_rollback",
      eventId: paymentData?.eventId,
      classId: paymentData?.classId,
      studentId: paymentData?.studentId,
      paymentId,
      amount: paymentData?.amount,
      description: `Rolled back approved payment of ₹${paymentData?.amount || 0}. Reason: ${reason || "None specified"}`,
    });
  } finally {
    activePaymentRollbackLocks.delete(paymentId);
  }
}

const activePaymentCancelLocks = new Set<string>();

export async function cancelPaymentSubmission(
  paymentId: string,
  user: UserProfile
): Promise<void> {
  if (!user.active || !user.loginEnabled) {
    throw new Error("Unauthorized: Inactive user account.");
  }

  if (activePaymentCancelLocks.has(paymentId)) {
    throw new Error("A cancellation request for this submission is already being processed.");
  }

  activePaymentCancelLocks.add(paymentId);
  try {
    const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error("Payment submission not found.");
    }
    const paymentData = snap.data() as PaymentModel;

    // Only allow cancelling pending approval payments
    if (paymentData.status !== "pending_approval") {
      throw new Error("Only pending approval submissions can be cancelled.");
    }

    // Only allow the original submitter or super coordinator to cancel
    if (paymentData.addedBy !== user.uid && user.role !== "super_coordinator") {
      throw new Error("Unauthorized: You can only cancel your own pending payment submissions.");
    }

    const now = serverTimestamp();
    await updateDoc(ref, {
      status: "cancelled" as PaymentStatus,
      cancelledBy: user.uid,
      cancelledByName: user.name,
      cancelledAt: now,
      updatedAt: now,
    });

    await logAudit({
      userId: user.uid,
      userRole: user.role === "super_coordinator" ? "Super Coordinator" : "Class Coordinator",
      userName: user.name,
      action: "PAYMENT_SUBMISSION_CANCELLED",
      category: "fund_collection",
      eventId: paymentData.eventId,
      classId: paymentData.classId,
      studentId: paymentData.studentId,
      paymentId,
      amount: paymentData.amount,
      description: `Cancelled pending payment submission of ₹${paymentData.amount || 0} for student ${paymentData.studentId}`,
      metadata: {
        paymentId,
        studentId: paymentData.studentId,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
      },
    });
  } finally {
    activePaymentCancelLocks.delete(paymentId);
  }
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
    return list;
  } catch (error) {
    console.error("Error fetching payments:", error);
    return [];
  }
}

export async function fetchPaymentById(paymentId: string): Promise<PaymentModel | null> {
  try {
    const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<PaymentModel, "id">) };
  } catch (error) {
    console.error("Error fetching payment by id:", error);
    return null;
  }
}

export async function fetchPaymentsByStudent(studentId: string): Promise<PaymentModel[]> {
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
    console.error("Error fetching payments by student:", error);
    return [];
  }
}
