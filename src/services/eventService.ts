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
  if (user.role !== "super_coordinator" || user.active === false || user.loginEnabled === false) {
    throw new Error("Unauthorized: Only an active Super Coordinator can create events.");
  }

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
  if (user.role !== "super_coordinator" || user.active === false || user.loginEnabled === false) {
    throw new Error("Unauthorized: Only an active Super Coordinator can update events.");
  }

  // If status is being updated, delegate to setEventStatus to ensure correct timestamps and audit logs
  if (updates.status) {
    return setEventStatus(id, updates.status, user);
  }

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

export async function reopenEvent(
  id: string,
  user: UserProfile
): Promise<void> {
  // Service layer authorization: exclusively active Super Coordinators
  if (user.role !== "super_coordinator" || user.active === false || user.loginEnabled === false) {
    throw new Error("Unauthorized: Only an active Super Coordinator can reopen an event.");
  }
  return setEventStatus(id, "active", user);
}

export async function setEventStatus(
  id: string,
  status: EventStatus,
  user: UserProfile
): Promise<void> {
  // Service layer authorization: exclusively active Super Coordinators
  if (user.role !== "super_coordinator" || user.active === false || user.loginEnabled === false) {
    throw new Error("Unauthorized: Only an active Super Coordinator can change or reopen event status.");
  }

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
  } else if (status === "active") {
    updates.reopenedAt = serverTimestamp();
    updates.reopenedBy = user.uid;
  }

  await updateDoc(ref, updates);

  const auditAction =
    status === "active"
      ? "EVENT_REOPENED"
      : status === "closed"
      ? "EVENT_CLOSED"
      : `set_status_${status}`;

  const auditDescription =
    status === "active"
      ? `Reopened event by Super Coordinator ${user.name}`
      : status === "closed"
      ? `Closed event by Super Coordinator ${user.name}`
      : `Changed event status to ${status}`;

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: auditAction,
    category: "event_management",
    eventId: id,
    description: auditDescription,
  });
}

export async function duplicateEvent(
  sourceEventId: string,
  newName: string,
  user: UserProfile
): Promise<EventModel> {
  if (user.role !== "super_coordinator" || user.active === false || user.loginEnabled === false) {
    throw new Error("Unauthorized: Only an active Super Coordinator can duplicate events.");
  }

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
