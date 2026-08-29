export const COLLECTIONS = {
  USERS: "users",
  EVENTS: "events",
  CLASSES: "classes",
  STUDENTS: "students",
  EVENT_PARTICIPANTS: "eventParticipants",
  PAYMENTS: "payments",
  CENTRAL_RECEIPTS: "centralReceipts",
  EXPENSES: "expenses",
  ADJUSTMENTS: "adjustments",
  DAILY_CLOSINGS: "dailyClosings",
  AUDIT_LOGS: "auditLogs",
  COORDINATOR_ASSIGNMENTS: "coordinatorAssignments",
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
