import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import { COLLECTIONS } from "../firebase/collections";
import type {
  CoordinatorAssignmentModel,
  CoordinatorPermissions,
  ViewerPermissions,
  ViewerScope,
  CrossClassCapabilities,
  UserProfile,
} from "../types";
import { logAudit } from "./auditService";

export async function fetchUsers(): Promise<UserProfile[]> {
  try {
    const ref = collection(db, COLLECTIONS.USERS);
    const snap = await getDocs(ref);
    const list: UserProfile[] = [];
    snap.forEach((d) => {
      list.push({ uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) });
    });
    return list;
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export function subscribeToUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = collection(db, COLLECTIONS.USERS);
  return onSnapshot(
    ref,
    (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        list.push({ uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) });
      });
      onData(list);
    },
    (err) => {
      console.error("Error subscribing to users:", err);
      if (onError) onError(err);
    }
  );
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>,
  currentUser: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  const snap = await getDoc(ref);
  const oldData = snap.data();

  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    userId: currentUser.uid,
    userRole: currentUser.role,
    userName: currentUser.name,
    action: "update_user_profile",
    category: "user_management",
    description: `Updated profile/role for user ${oldData?.name || uid} (Active: ${updates.active ?? oldData?.active}, Login: ${updates.loginEnabled ?? oldData?.loginEnabled}, Role: ${updates.role ?? oldData?.role})`,
    metadata: { uid, old: oldData, new: updates },
  });
}

export interface CreateAssignmentParams {
  userId: string;
  eventId: string;
  classId?: string;
  assignmentType?: "class_coordinator" | "view_coordinator" | "cross_class_assistant";
  permissions?: Partial<CoordinatorPermissions>;
  viewerScope?: ViewerScope;
  viewerPermissions?: Partial<ViewerPermissions>;
  crossClassCollection?: {
    enabled: boolean;
    authorizedClassIds: string[];
    capabilities: CrossClassCapabilities;
  };
}

export async function createCoordinatorAssignment(
  params: CreateAssignmentParams,
  currentUser: UserProfile
): Promise<CoordinatorAssignmentModel> {
  const ref = collection(db, COLLECTIONS.COORDINATOR_ASSIGNMENTS);
  const now = serverTimestamp();

  const defaultPerms: CoordinatorPermissions = {
    canView: true,
    canViewStudents: true,
    canAddPayment: true,
    canAddInstallment: true,
    canEditPayment: false,
    canViewReports: true,
    ...params.permissions,
  };

  const defaultViewerPerms: ViewerPermissions = {
    canViewAggregate: true,
    canViewStudentCollectionStatus: false,
    canViewExpenses: false,
    canViewExpenseCategories: false,
    ...params.viewerPermissions,
  };

  const data: Record<string, any> = {
    userId: params.userId,
    eventId: params.eventId,
    classId: params.classId || "",
    active: true,
    assignmentType: params.assignmentType || "class_coordinator",
    permissions: defaultPerms,
    viewerScope: params.viewerScope || "whole_event",
    viewerPermissions: defaultViewerPerms,
    crossClassCollection: params.crossClassCollection || {
      enabled: false,
      authorizedClassIds: [],
      capabilities: {
        canViewCollection: true,
        canAddPayment: false,
        canAddInstallment: false,
        canHandlePendingApprovals: false,
        canAccessCentralReceipts: false,
      },
    },
    assignedBy: currentUser.uid,
    assignedByName: currentUser.name,
    assignedAt: now,
    updatedAt: now,
  };

  const deterministicId = `${params.userId}_${params.eventId}`;
  const docRef = doc(ref, deterministicId);
  await setDoc(docRef, data, { merge: true });

  await logAudit({
    userId: currentUser.uid,
    userRole: currentUser.role,
    userName: currentUser.name,
    action: "create_assignment",
    category: "permission_change",
    eventId: params.eventId,
    classId: params.classId,
    description: `Assigned user ${params.userId} (${params.assignmentType || "coordinator"}) in event ${params.eventId}`,
    metadata: { assignmentId: deterministicId, params },
  });

  return {
    id: deterministicId,
    ...data,
  } as CoordinatorAssignmentModel;
}

export async function updateCoordinatorAssignment(
  id: string,
  updates: Partial<CoordinatorAssignmentModel>,
  currentUser: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.COORDINATOR_ASSIGNMENTS, id);
  const snap = await getDoc(ref);
  const oldData = snap.data();

  const updatePayload = {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  };

  await updateDoc(ref, updatePayload);

  // If existing document has a non-deterministic ID, mirror to deterministic ID for Firestore Security Rules
  const targetUserId = updates.userId || oldData?.userId;
  const targetEventId = updates.eventId || oldData?.eventId;
  if (targetUserId && targetEventId) {
    const deterministicId = `${targetUserId}_${targetEventId}`;
    if (id !== deterministicId) {
      const deterministicRef = doc(db, COLLECTIONS.COORDINATOR_ASSIGNMENTS, deterministicId);
      await setDoc(deterministicRef, { ...oldData, ...updatePayload }, { merge: true });
    }
  }

  await logAudit({
    userId: currentUser.uid,
    userRole: currentUser.role,
    userName: currentUser.name,
    action: "update_assignment_permissions",
    category: "permission_change",
    eventId: updates.eventId || oldData?.eventId,
    classId: updates.classId || oldData?.classId,
    description: `Updated permissions/scope for coordinator assignment ${id} (User: ${oldData?.userId})`,
    metadata: {
      assignmentId: id,
      targetUserId: oldData?.userId,
      oldPermissions: oldData?.permissions,
      newPermissions: updates.permissions,
      oldViewerScope: oldData?.viewerScope,
      newViewerScope: updates.viewerScope,
      oldViewerPermissions: oldData?.viewerPermissions,
      newViewerPermissions: updates.viewerPermissions,
      oldCrossClass: oldData?.crossClassCollection,
      newCrossClass: updates.crossClassCollection,
      active: updates.active ?? oldData?.active,
    },
  });
}

/**
 * Subscribes to real-time coordinator assignments for a specific user.
 */
export function subscribeToUserAssignments(
  userId: string,
  onData: (assignments: CoordinatorAssignmentModel[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = collection(db, COLLECTIONS.COORDINATOR_ASSIGNMENTS);
  const q = query(ref, where("userId", "==", userId));

  return onSnapshot(
    q,
    (snap) => {
      const list: CoordinatorAssignmentModel[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        list.push({
          id: d.id,
          userId: raw.userId,
          eventId: raw.eventId,
          classId: raw.classId || "",
          active: raw.active ?? true,
          assignmentType: raw.assignmentType || "class_coordinator",
          permissions: {
            canView: raw.permissions?.canView ?? true,
            canViewStudents: raw.permissions?.canViewStudents ?? true,
            canAddPayment: raw.permissions?.canAddPayment ?? true,
            canAddInstallment: raw.permissions?.canAddInstallment ?? true,
            canEditPayment: raw.permissions?.canEditPayment ?? false,
            canViewReports: raw.permissions?.canViewReports ?? true,
          },
          viewerScope: raw.viewerScope || "whole_event",
          viewerPermissions: {
            canViewAggregate: raw.viewerPermissions?.canViewAggregate ?? true,
            canViewStudentCollectionStatus:
              raw.viewerPermissions?.canViewStudentCollectionStatus ?? false,
            canViewExpenses: raw.viewerPermissions?.canViewExpenses ?? false,
            canViewExpenseCategories:
              raw.viewerPermissions?.canViewExpenseCategories ?? false,
          },
          crossClassCollection: raw.crossClassCollection || {
            enabled: false,
            authorizedClassIds: [],
            capabilities: {
              canViewCollection: true,
              canAddPayment: false,
              canAddInstallment: false,
              canHandlePendingApprovals: false,
            },
          },
          assignedBy: raw.assignedBy,
          assignedByName: raw.assignedByName,
          assignedAt: raw.assignedAt,
          updatedAt: raw.updatedAt,
          updatedBy: raw.updatedBy,
        });
      });
      onData(list);
    },
    (err) => {
      console.error("Error in subscribeToUserAssignments:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * One-time fetch for coordinator assignments.
 */
export async function fetchCoordinatorAssignments(
  eventId?: string,
  userId?: string
): Promise<CoordinatorAssignmentModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.COORDINATOR_ASSIGNMENTS);
    let q = query(ref);

    if (eventId && userId) {
      q = query(
        ref,
        where("eventId", "==", eventId),
        where("userId", "==", userId)
      );
    } else if (eventId) {
      q = query(ref, where("eventId", "==", eventId));
    } else if (userId) {
      q = query(ref, where("userId", "==", userId));
    }

    const snap = await getDocs(q);
    const list: CoordinatorAssignmentModel[] = [];
    snap.forEach((d) => {
      const raw = d.data();
      list.push({
        id: d.id,
        userId: raw.userId,
        eventId: raw.eventId,
        classId: raw.classId || "",
        active: raw.active ?? true,
        assignmentType: raw.assignmentType || "class_coordinator",
        permissions: {
          canView: raw.permissions?.canView ?? true,
          canViewStudents: raw.permissions?.canViewStudents ?? true,
          canAddPayment: raw.permissions?.canAddPayment ?? true,
          canAddInstallment: raw.permissions?.canAddInstallment ?? true,
          canEditPayment: raw.permissions?.canEditPayment ?? false,
          canViewReports: raw.permissions?.canViewReports ?? true,
        },
        viewerScope: raw.viewerScope || "whole_event",
        viewerPermissions: {
          canViewAggregate: raw.viewerPermissions?.canViewAggregate ?? true,
          canViewStudentCollectionStatus:
            raw.viewerPermissions?.canViewStudentCollectionStatus ?? false,
          canViewExpenses: raw.viewerPermissions?.canViewExpenses ?? false,
          canViewExpenseCategories:
            raw.viewerPermissions?.canViewExpenseCategories ?? false,
        },
        crossClassCollection: raw.crossClassCollection || {
          enabled: false,
          authorizedClassIds: [],
          capabilities: {
            canViewCollection: true,
            canAddPayment: false,
            canAddInstallment: false,
            canHandlePendingApprovals: false,
          },
        },
        assignedBy: raw.assignedBy,
        assignedByName: raw.assignedByName,
        assignedAt: raw.assignedAt,
        updatedAt: raw.updatedAt,
        updatedBy: raw.updatedBy,
      });
    });
    return list;
  } catch (error) {
    console.error("Error fetching coordinator assignments:", error);
    return [];
  }
}
