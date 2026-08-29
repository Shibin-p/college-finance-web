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
import type { DailyClosingModel, UserProfile } from "../types";
import { calculateDailyClosingBalance } from "../utils/calculations";
import { logAudit } from "./auditService";

export interface CreateDailyClosingParams {
  eventId: string;
  date: string;
  openingBalance: number;
  moneyReceived: number;
  moneySpent: number;
  remarks?: string;
}

export async function createDailyClosing(
  params: CreateDailyClosingParams,
  user: UserProfile
): Promise<DailyClosingModel> {
  const closingBalance = calculateDailyClosingBalance(
    params.openingBalance,
    params.moneyReceived,
    params.moneySpent
  );

  const ref = collection(db, COLLECTIONS.DAILY_CLOSINGS);
  const now = serverTimestamp();

  const data: Record<string, any> = {
    eventId: params.eventId,
    date: params.date,
    openingBalance: Number(params.openingBalance || 0),
    moneyReceived: Number(params.moneyReceived || 0),
    moneySpent: Number(params.moneySpent || 0),
    closingBalance,
    closedBy: user.uid,
    closedByName: user.name,
    closedAt: now,
    remarks: params.remarks?.trim() || "",
  };

  const docRef = await addDoc(ref, data);

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "create_daily_closing",
    category: "daily_closing",
    eventId: params.eventId,
    amount: closingBalance,
    description: `Completed daily closing for ${params.date}: Opening (₹${params.openingBalance}), Received (₹${params.moneyReceived}), Spent (₹${params.moneySpent}), Closing Balance (₹${closingBalance})`,
  });

  return {
    id: docRef.id,
    ...data,
  } as DailyClosingModel;
}

export async function fetchDailyClosings(eventId: string): Promise<DailyClosingModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.DAILY_CLOSINGS);
    const q = query(ref, where("eventId", "==", eventId));
    const snap = await getDocs(q);
    const list: DailyClosingModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<DailyClosingModel, "id">) });
    });
    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  } catch (error) {
    console.error(`Error fetching daily closings for event ${eventId}:`, error);
    return [];
  }
}
