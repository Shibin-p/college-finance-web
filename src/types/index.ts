export type UserRole = "super_coordinator" | "class_coordinator" | "view_coordinator";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  loginEnabled: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export type EventStatus = "active" | "closed" | "archived";

export interface ExpenseCategoryConfig {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  isDefault?: boolean;
}

export interface EventModel {
  id: string;
  name: string;
  description?: string;
  status: EventStatus;
  installmentsEnabled: boolean;
  targetAmountEnabled: boolean;
  defaultTargetAmount: number;
  approvalRequired: boolean;
  customExpenseCategories?: ExpenseCategoryConfig[];
  createdAt?: any;
  createdBy: string;
  updatedAt?: any;
  updatedBy: string;
  closedAt?: any | null;
  archivedAt?: any | null;
}

export const DEPARTMENTS = [
  "CSE",
  "CSBS",
  "Cyber",
  "AIDS",
  "Civil",
  "Mech",
  "ECE",
  "SFE",
  "BCA",
] as const;

export type Department = typeof DEPARTMENTS[number];

export interface ClassModel {
  id: string;
  displayName: string;
  department: Department | string;
  year: number;
  section: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface StudentModel {
  id: string;
  name: string;
  registerNumber: string;
  classId: string;
  department: string;
  year: number;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export type ParticipationStatus = "eligible" | "exempted" | "not_participating";

export interface EventParticipantModel {
  id: string;
  eventId: string;
  studentId: string;
  classId: string;
  participationStatus: ParticipationStatus;
  requiredAmount: number;
  targetAmountEnabled: boolean;
  exemption?: boolean;
  exemptionReason?: string;
  exemptedBy?: string;
  exemptedAt?: any;
  coordinatorWaiver?: boolean;
  coordinatorWaiverAmount?: number;
  coordinatorWaiverBy?: string;
  coordinatorWaiverAt?: any;
}

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "other";

export type PaymentStatus = "pending_approval" | "approved" | "declined" | "rolled_back";

export interface PaymentModel {
  id: string;
  eventId: string;
  participantId: string;
  studentId: string;
  classId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  status: PaymentStatus;
  addedBy: string;
  addedByName?: string;
  addedAt: any;
  updatedAt?: any;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: any;
  declinedBy?: string;
  declinedByName?: string;
  declinedAt?: any;
  rolledBackBy?: string;
  rolledBackByName?: string;
  rolledBackAt?: any;
}

export interface CentralReceiptModel {
  id: string;
  serialNumber?: string;
  eventId: string;
  classId: string;
  totalAmount: number;
  cashAmount: number;
  digitalAmount: number;
  otherAmount: number;
  date: string; // YYYY-MM-DD
  time?: string;
  receivedBy: string;
  receivedByName?: string;
  remarks?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryConfig[] = [
  { id: "cat-decoration", name: "Decoration", active: true, isDefault: true },
  { id: "cat-food", name: "Food", active: true, isDefault: true },
  { id: "cat-sound", name: "Sound", active: true, isDefault: true },
  { id: "cat-transport", name: "Transportation", active: true, isDefault: true },
  { id: "cat-printing", name: "Printing", active: true, isDefault: true },
  { id: "cat-stage", name: "Stage", active: true, isDefault: true },
  { id: "cat-photography", name: "Photography", active: true, isDefault: true },
  { id: "cat-flowers", name: "Flowers", active: true, isDefault: true },
  { id: "cat-rope", name: "Rope", active: true, isDefault: true },
  { id: "cat-venue", name: "Venue", active: true, isDefault: true },
  { id: "cat-gifts", name: "Gifts", active: true, isDefault: true },
  { id: "cat-misc", name: "Miscellaneous", active: true, isDefault: true },
];

export type ExpenseCategory = string;

export type ExpenseStatus = "active" | "reversed" | "voided";

export interface ExpenseModel {
  id: string;
  eventId: string;
  category: ExpenseCategory;
  item: string;
  amount: number;
  remarks?: string;
  addedBy: string;
  addedByName?: string;
  createdAt?: any;
  updatedAt?: any;
  status: ExpenseStatus;
}

export interface AdjustmentModel {
  id: string;
  eventId: string;
  amountAdjustment: number;
  countAdjustment: number;
  description?: string;
  addedBy: string;
  addedByName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DailyClosingModel {
  id: string;
  eventId: string;
  date: string; // YYYY-MM-DD
  openingBalance: number;
  moneyReceived: number;
  moneySpent: number;
  closingBalance: number;
  closedBy: string;
  closedByName?: string;
  closedAt?: any;
  remarks?: string;
}

export type AuditCategory =
  | "login"
  | "logout"
  | "login_failed"
  | "user_management"
  | "permission_change"
  | "event_management"
  | "class_management"
  | "student_management"
  | "fund_collection"
  | "fund_approval"
  | "payment_rollback"
  | "installment"
  | "exemption"
  | "coordinator_waiver"
  | "central_receipt"
  | "reconciliation"
  | "expense"
  | "expense_category"
  | "finance_adjustment"
  | "daily_closing"
  | "report_export";

export interface AuditLogModel {
  id: string;
  timestamp: any;
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

export interface CoordinatorPermissions {
  canView: boolean;
  canViewStudents: boolean;
  canAddPayment: boolean;
  canAddInstallment: boolean;
  canEditPayment: boolean;
  canViewReports: boolean;
}

export type ViewerScope = "whole_event" | "specific_class";

export interface ViewerPermissions {
  canViewAggregate: boolean;
  canViewStudentCollectionStatus: boolean;
  canViewExpenses: boolean;
  canViewExpenseCategories?: boolean;
}

export interface CrossClassCapabilities {
  canViewCollection: boolean;
  canAddPayment: boolean;
  canAddInstallment: boolean;
  canHandlePendingApprovals: boolean;
}

export interface CoordinatorAssignmentModel {
  id: string;
  userId: string;
  eventId: string;
  classId?: string;
  active: boolean;
  assignmentType?: "class_coordinator" | "view_coordinator" | "cross_class_assistant";
  permissions: CoordinatorPermissions;
  viewerScope?: ViewerScope;
  viewerPermissions?: ViewerPermissions;
  crossClassCollection?: {
    enabled: boolean;
    authorizedClassIds: string[];
    capabilities: CrossClassCapabilities;
  };
  assignedBy: string;
  assignedByName?: string;
  assignedAt: any;
  updatedAt?: any;
  updatedBy?: string;
}

export type CountMode =
  | "fully_paid"
  | "paid_any"
  | "partially_paid"
  | "pending"
  | "not_paid"
  | "settled";

export type StudentPaymentStatus = "not_paid" | "partially_paid" | "fully_paid" | "exempted";

export type PublicStudentStatus = "Paid" | "Partially Paid" | "Pending" | "Exempted";

export type ReportMode = "class_wise" | "year_wise";

export interface YearWiseStatsModel {
  year: number;
  yearLabel: string;
  totalStudents: number;
  eligibleStudents: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  pendingCount: number;
  exemptedCount: number;
  coordinatorWaivedCount: number;
  settledCount: number; // fullyPaidCount + coordinatorWaivedCount
  totalTarget: number;
  totalCollected: number;
  remainingBalance: number;
  collectionPercentage: number;
}

export interface ClassWiseViewerStatsModel {
  classId: string;
  className: string;
  department: string;
  year: number;
  totalStudents: number;
  eligibleStudents: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  pendingCount: number;
  exemptedCount: number;
  coordinatorWaivedCount: number;
  settledCount: number;
  totalTarget: number;
  totalCollected: number;
  remainingBalance: number;
  collectionPercentage: number;
}
