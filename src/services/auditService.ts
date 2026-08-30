import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import { COLLECTIONS } from "../firebase/collections";
import type { AuditCategory, AuditLogModel, UserRole } from "../types";

export interface LogAuditParams {
  userId: string;
  userRole: UserRole | string;
  userName?: string;
  action: string;
  category: AuditCategory;
  eventId?: string;
  eventName?: string;
  classId?: string;
  className?: string;
  studentId?: string;
  studentName?: string;
  paymentId?: string;
  expenseId?: string;
  receiptId?: string;
  amount?: number;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Appends an immutable audit log entry.
 */
export async function logAudit(params: LogAuditParams): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      ...params,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Failed to write audit log:", error);
    return "";
  }
}

export interface AuditFilterParams {
  eventId?: string; // "all" | "global" | specific eventId
  classId?: string;
  category?: AuditCategory | "all";
  userId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  searchTerm?: string;
  limitCount?: number;
}

/**
 * Helper to apply in-memory multi-attribute filters cleanly.
 */
export function applyAuditFilters(
  logs: AuditLogModel[],
  filter: AuditFilterParams
): AuditLogModel[] {
  return logs.filter((log) => {
    // Event filter
    if (filter.eventId && filter.eventId !== "all") {
      if (filter.eventId === "global") {
        if (log.eventId) return false;
      } else {
        if (log.eventId !== filter.eventId) return false;
      }
    }

    // Category filter
    if (filter.category && filter.category !== "all" && log.category !== filter.category) {
      return false;
    }

    // User filter
    if (filter.userId && filter.userId !== "all" && log.userId !== filter.userId) {
      return false;
    }

    // Class filter
    if (filter.classId && filter.classId !== "all" && log.classId !== filter.classId) {
      return false;
    }

    // Date range filter
    if (filter.startDate || filter.endDate) {
      const logDate = log.timestamp?.seconds
        ? new Date(log.timestamp.seconds * 1000).toISOString().slice(0, 10)
        : "";
      if (filter.startDate && logDate && logDate < filter.startDate) return false;
      if (filter.endDate && logDate && logDate > filter.endDate) return false;
    }

    // Search term (action, description, user, student, class)
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      const desc = log.description?.toLowerCase() || "";
      const action = log.action?.toLowerCase() || "";
      const uName = log.userName?.toLowerCase() || "";
      const cName = log.className?.toLowerCase() || "";
      const sName = log.studentName?.toLowerCase() || "";
      if (
        !desc.includes(term) &&
        !action.includes(term) &&
        !uName.includes(term) &&
        !cName.includes(term) &&
        !sName.includes(term)
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Subscribes to real-time audit logs with event-scoped Firestore query or graceful fallback.
 */
export function subscribeToAuditLogs(
  filter: AuditFilterParams,
  onData: (logs: AuditLogModel[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const logsRef = collection(db, COLLECTIONS.AUDIT_LOGS);
  const maxLimit = filter.limitCount || 300;

  // Try event query if eventId is a specific ID
  let q = query(logsRef, orderBy("timestamp", "desc"), limit(maxLimit));

  if (filter.eventId && filter.eventId !== "all" && filter.eventId !== "global") {
    try {
      q = query(
        logsRef,
        where("eventId", "==", filter.eventId),
        orderBy("timestamp", "desc"),
        limit(maxLimit)
      );
    } catch {
      q = query(logsRef, orderBy("timestamp", "desc"), limit(maxLimit));
    }
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AuditLogModel[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<AuditLogModel, "id">;
        logs.push({
          id: doc.id,
          ...data,
        });
      });
      const filtered = applyAuditFilters(logs, filter);
      onData(filtered);
    },
    (error) => {
      console.warn("Audit logs query error, falling back to top-level order query:", error);
      // Fallback query without where clause in case composite index is still creating
      const fallbackQ = query(logsRef, orderBy("timestamp", "desc"), limit(maxLimit));
      return onSnapshot(
        fallbackQ,
        (snapshot) => {
          const fallbackLogs: AuditLogModel[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as Omit<AuditLogModel, "id">;
            fallbackLogs.push({ id: doc.id, ...data });
          });
          onData(applyAuditFilters(fallbackLogs, filter));
        },
        (fallbackErr) => {
          console.error("Critical error subscribing to audit logs:", fallbackErr);
          if (onError) onError(fallbackErr);
        }
      );
    }
  );
}

/**
 * One-time fetch for audit logs.
 */
export async function fetchAuditLogs(filter: AuditFilterParams = {}): Promise<AuditLogModel[]> {
  try {
    const logsRef = collection(db, COLLECTIONS.AUDIT_LOGS);
    const maxLimit = filter.limitCount || 300;
    let q = query(logsRef, orderBy("timestamp", "desc"), limit(maxLimit));

    if (filter.eventId && filter.eventId !== "all" && filter.eventId !== "global") {
      try {
        q = query(
          logsRef,
          where("eventId", "==", filter.eventId),
          orderBy("timestamp", "desc"),
          limit(maxLimit)
        );
      } catch {
        q = query(logsRef, orderBy("timestamp", "desc"), limit(maxLimit));
      }
    }

    let snapshot;
    try {
      snapshot = await getDocs(q);
    } catch {
      // Fallback
      snapshot = await getDocs(query(logsRef, orderBy("timestamp", "desc"), limit(maxLimit)));
    }

    const logs: AuditLogModel[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Omit<AuditLogModel, "id">;
      logs.push({
        id: doc.id,
        ...data,
      });
    });

    return applyAuditFilters(logs, filter);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }
}
