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
import type { AdjustmentModel, UserProfile } from "../types";
import { logAudit } from "./auditService";

export interface CreateAdjustmentParams {
  eventId: string;
  amountAdjustment: number;
  countAdjustment: number;
  description?: string;
}

export async function createAdjustment(
  params: CreateAdjustmentParams,
  user: UserProfile
): Promise<AdjustmentModel> {
  const ref = collection(db, COLLECTIONS.ADJUSTMENTS);
  const now = serverTimestamp();

  const data: Record<string, any> = {
    eventId: params.eventId,
    amountAdjustment: Number(params.amountAdjustment || 0),
    countAdjustment: Number(params.countAdjustment || 0),
    description: params.description?.trim() || "",
    addedBy: user.uid,
    addedByName: user.name,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(ref, data);

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "create_adjustment",
    category: "finance_adjustment",
    eventId: params.eventId,
    amount: params.amountAdjustment,
    description: `Added financial adjustment: Amount (₹${params.amountAdjustment}), Count (${params.countAdjustment}). Note: ${params.description}`,
  });

  return {
    id: docRef.id,
    ...data,
  } as AdjustmentModel;
}

export async function fetchAdjustments(eventId: string): Promise<AdjustmentModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.ADJUSTMENTS);
    const q = query(ref, where("eventId", "==", eventId));
    const snap = await getDocs(q);
    const list: AdjustmentModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<AdjustmentModel, "id">) });
    });
    return list;
  } catch (error) {
    console.error(`Error fetching adjustments for event ${eventId}:`, error);
    return [];
  }
}
