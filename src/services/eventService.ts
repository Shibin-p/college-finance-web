import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import { COLLECTIONS } from "../firebase/collections";
import type { EventModel, EventStatus, UserProfile } from "../types";
import { logAudit } from "./auditService";

export async function fetchEvents(): Promise<EventModel[]> {
  try {
    const eventsRef = collection(db, COLLECTIONS.EVENTS);
    const q = query(eventsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const list: EventModel[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<EventModel, "id">) });
    });
    return list;
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

export async function fetchEventById(id: string): Promise<EventModel | null> {
  try {
    const ref = doc(db, COLLECTIONS.EVENTS, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<EventModel, "id">) };
  } catch (error) {
    console.error(`Error fetching event ${id}:`, error);
    return null;
  }
}

export async function createEvent(
  params: {
    name: string;
    description?: string;
    installmentsEnabled: boolean;
    targetAmountEnabled: boolean;
    defaultTargetAmount: number;
    approvalRequired: boolean;
  },
  user: UserProfile
): Promise<EventModel> {
  const eventsRef = collection(db, COLLECTIONS.EVENTS);
  const now = serverTimestamp();

  const docRef = await addDoc(eventsRef, {
    name: params.name.trim(),
    description: params.description?.trim() || "",
    status: "active" as EventStatus,
    installmentsEnabled: params.installmentsEnabled,
    targetAmountEnabled: params.targetAmountEnabled,
    defaultTargetAmount: params.defaultTargetAmount || 0,
    approvalRequired: params.approvalRequired,
    createdAt: now,
    createdBy: user.uid,
    updatedAt: now,
    updatedBy: user.uid,
    closedAt: null,
    archivedAt: null,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "create_event",
    category: "event_management",
    eventId: docRef.id,
    description: `Created event "${params.name}"`,
  });

  return {
    id: docRef.id,
    name: params.name.trim(),
    description: params.description?.trim() || "",
    status: "active",
    installmentsEnabled: params.installmentsEnabled,
    targetAmountEnabled: params.targetAmountEnabled,
    defaultTargetAmount: params.defaultTargetAmount || 0,
    approvalRequired: params.approvalRequired,
    createdBy: user.uid,
    updatedBy: user.uid,
  };
}

export async function updateEvent(
  id: string,
  updates: Partial<EventModel>,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.EVENTS, id);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "update_event",
    category: "event_management",
    eventId: id,
    description: `Updated event settings for event ID ${id}`,
  });
}

export async function setEventStatus(
  id: string,
  status: EventStatus,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.EVENTS, id);
  const updates: Record<string, any> = {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  };

  if (status === "closed") {
    updates.closedAt = serverTimestamp();
  } else if (status === "archived") {
    updates.archivedAt = serverTimestamp();
  }

  await updateDoc(ref, updates);

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: `set_status_${status}`,
    category: "event_management",
    eventId: id,
    description: `Changed event status to ${status}`,
  });
}

export async function duplicateEvent(
  sourceEventId: string,
  newName: string,
  user: UserProfile
): Promise<EventModel> {
  const source = await fetchEventById(sourceEventId);
  if (!source) throw new Error("Source event not found");

  return createEvent(
    {
      name: newName,
      description: source.description || "",
      installmentsEnabled: source.installmentsEnabled,
      targetAmountEnabled: source.targetAmountEnabled,
      defaultTargetAmount: source.defaultTargetAmount,
      approvalRequired: source.approvalRequired,
    },
    user
  );
}
