import type {
  EventParticipantModel,
  PaymentModel,
  AdjustmentModel,
  ExpenseModel,
  CentralReceiptModel,
  CountMode,
  PublicStudentStatus,
  YearWiseStatsModel,
  ClassWiseViewerStatsModel,
  ClassModel,
} from "../types";

export interface StudentFinancialSummary {
  studentId: string;
  participantId?: string;
  classId: string;
  requiredAmount: number;
  totalPaid: number;
  approvedPaid: number;
  pendingApprovalAmount: number;
  remainingAmount: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  isUnpaid: boolean;
  isExempted: boolean;
  isCoordinatorWaived: boolean;
  paymentCount: number;
  collectionPercentage: number;
}

export interface AggregateFinancialTotals {
  totalStudents: number;
  eligibleStudents: number;
  exemptedStudents: number;
  waivedStudents: number;
  fullyPaidCount: number;
  paidAnyCount: number;
  partiallyPaidCount: number;
  pendingCount: number;
  notPaidCount: number;
  settledCount: number;
  totalRequired: number;
  totalApprovedReceived: number;
  totalPendingApproval: number;
  totalOutstanding: number;
  totalExpenses: number;
  balanceRemaining: number;
  collectionPercentage: number;
  adjustedTotalAmount: number;
  adjustedTotalCount: number;
  totalAmountAdjustments: number;
  totalCountAdjustments: number;
}

/**
 * Calculates financial metrics for a single participant / student.
 * Pure deterministic function.
 */
export function calculateStudentFinancials(
  participant: Partial<EventParticipantModel> | undefined,
  payments: PaymentModel[]
): StudentFinancialSummary {
  const studentId = participant?.studentId || "";
  const participantId = participant?.id;
  const classId = participant?.classId || "";
  const isExempted =
    participant?.participationStatus === "exempted" || !!participant?.exemption;
  const isCoordinatorWaived = !!participant?.coordinatorWaiver;

  const requiredAmount = Math.max(0, participant?.requiredAmount || 0);

  // Calculate payments for this student
  let totalPaid = 0;
  let approvedPaid = 0;
  let pendingApprovalAmount = 0;
  let paymentCount = 0;

  for (const p of payments) {
    if (p.status === "approved") {
      approvedPaid += p.amount || 0;
      totalPaid += p.amount || 0;
      paymentCount++;
    } else if (p.status === "pending_approval") {
      pendingApprovalAmount += p.amount || 0;
      totalPaid += p.amount || 0;
      paymentCount++;
    }
  }

  // If coordinator waiver applies, remaining calculation takes this into account
  const effectivePaid =
    approvedPaid +
    (isCoordinatorWaived
      ? participant?.coordinatorWaiverAmount || requiredAmount
      : 0);
  const remainingAmount = isExempted
    ? 0
    : Math.max(0, requiredAmount - effectivePaid);

  const isFullyPaid =
    isExempted || (requiredAmount > 0 && effectivePaid >= requiredAmount);
  const isPartiallyPaid = !isExempted && !isFullyPaid && approvedPaid > 0;
  const isUnpaid = !isExempted && !isCoordinatorWaived && approvedPaid === 0;

  const collectionPercentage =
    requiredAmount > 0
      ? Math.min(100, Math.round((approvedPaid / requiredAmount) * 100))
      : 0;

  return {
    studentId,
    participantId,
    classId,
    requiredAmount,
    totalPaid,
    approvedPaid,
    pendingApprovalAmount,
    remainingAmount,
    isFullyPaid,
    isPartiallyPaid,
    isUnpaid,
    isExempted,
    isCoordinatorWaived,
    paymentCount,
    collectionPercentage,
  };
}

/**
 * Resolves public student status for viewer and operational lists.
 * In accordance with privacy rules:
 * - Coordinator-waived students strictly resolve to "Paid"
 * - Exemptions resolve to "Exempted"
 * - Partially paid resolve to "Partially Paid"
 * - Otherwise "Pending"
 */
export function resolvePublicStudentStatus(
  participant: Partial<EventParticipantModel> | undefined,
  payments: PaymentModel[]
): PublicStudentStatus {
  const fin = calculateStudentFinancials(participant, payments);

  if (fin.isExempted) {
    return "Exempted";
  }
  if (fin.isFullyPaid || fin.isCoordinatorWaived) {
    return "Paid";
  }
  if (fin.isPartiallyPaid) {
    return "Partially Paid";
  }
  return "Pending";
}

/**
 * Calculates aggregate financial totals for a list of participants and payments.
 * Pure deterministic function.
 */
export function calculateAggregateTotals(
  participants: EventParticipantModel[],
  payments: PaymentModel[],
  adjustments: AdjustmentModel[] = [],
  expenses: ExpenseModel[] = []
): AggregateFinancialTotals {
  const totalStudents = participants.length;
  let eligibleStudents = 0;
  let exemptedStudents = 0;
  let waivedStudents = 0;
  let fullyPaidCount = 0;
  let paidAnyCount = 0;
  let partiallyPaidCount = 0;
  let pendingCount = 0;
  let notPaidCount = 0;
  let settledCount = 0;

  let totalRequired = 0;
  let totalApprovedReceived = 0;
  let totalPendingApproval = 0;
  let totalOutstanding = 0;

  // Group payments by participantId or studentId
  const paymentsByStudent: Record<string, PaymentModel[]> = {};
  for (const p of payments) {
    const key = p.participantId || p.studentId;
    if (!paymentsByStudent[key]) {
      paymentsByStudent[key] = [];
    }
    paymentsByStudent[key].push(p);
  }

  for (const participant of participants) {
    const studentPayments =
      paymentsByStudent[participant.id] ||
      paymentsByStudent[participant.studentId] ||
      [];
    const fin = calculateStudentFinancials(participant, studentPayments);

    if (fin.isExempted) {
      exemptedStudents++;
      settledCount++;
    } else {
      eligibleStudents++;
      totalRequired += fin.requiredAmount;
      totalOutstanding += fin.remainingAmount;

      if (fin.isFullyPaid) {
        fullyPaidCount++;
        settledCount++;
      } else if (fin.isPartiallyPaid) {
        partiallyPaidCount++;
        pendingCount++;
      } else if (fin.isUnpaid) {
        notPaidCount++;
        pendingCount++;
      }

      if (fin.approvedPaid > 0 || fin.pendingApprovalAmount > 0) {
        paidAnyCount++;
      }
    }

    if (fin.isCoordinatorWaived) {
      waivedStudents++;
    }

    totalApprovedReceived += fin.approvedPaid;
    totalPendingApproval += fin.pendingApprovalAmount;
  }

  // Calculate active expenses
  let totalExpenses = 0;
  for (const exp of expenses) {
    if (exp.status === "active") {
      totalExpenses += exp.amount || 0;
    }
  }

  // Adjustments
  let totalAmountAdjustments = 0;
  let totalCountAdjustments = 0;
  for (const adj of adjustments) {
    totalAmountAdjustments += adj.amountAdjustment || 0;
    totalCountAdjustments += adj.countAdjustment || 0;
  }

  const adjustedTotalAmount = totalApprovedReceived + totalAmountAdjustments;
  const adjustedTotalCount = fullyPaidCount + totalCountAdjustments;
  const balanceRemaining = totalApprovedReceived - totalExpenses;

  const collectionPercentage =
    totalRequired > 0
      ? Math.min(
          100,
          Math.round((totalApprovedReceived / totalRequired) * 100 * 10) / 10
        )
      : 0;

  return {
    totalStudents,
    eligibleStudents,
    exemptedStudents,
    waivedStudents,
    fullyPaidCount,
    paidAnyCount,
    partiallyPaidCount,
    pendingCount,
    notPaidCount,
    settledCount,
    totalRequired,
    totalApprovedReceived,
    totalPendingApproval,
    totalOutstanding,
    totalExpenses,
    balanceRemaining,
    collectionPercentage,
    adjustedTotalAmount,
    adjustedTotalCount,
    totalAmountAdjustments,
    totalCountAdjustments,
  };
}

/**
 * Calculates standard Year-Wise Statistics for Super Coordinator Reports and View Coordinator Year Analytics.
 * In accordance with semantic rules:
 * - Coordinator-waived students count as Settled/Paid for public viewer statistics.
 * - Exemptions remain separate as Exempted and are NOT counted as paid.
 */
export function calculateYearWiseStats(
  year: number,
  participants: EventParticipantModel[],
  payments: PaymentModel[],
  classes: (ClassModel | { id: string; year: number })[]
): YearWiseStatsModel {
  const classIdsInYear = new Set(
    classes.filter((c) => c.year === year).map((c) => c.id)
  );

  const yearParticipants = participants.filter((p) =>
    classIdsInYear.has(p.classId)
  );

  const paymentsByStudent: Record<string, PaymentModel[]> = {};
  for (const p of payments) {
    const key = p.participantId || p.studentId;
    if (!paymentsByStudent[key]) {
      paymentsByStudent[key] = [];
    }
    paymentsByStudent[key].push(p);
  }

  let eligibleStudents = 0;
  let exemptedCount = 0;
  let fullyPaidCount = 0;
  let partiallyPaidCount = 0;
  let pendingCount = 0;
  let coordinatorWaivedCount = 0;
  let totalTarget = 0;
  let totalCollected = 0;
  let remainingBalance = 0;

  for (const participant of yearParticipants) {
    const studentPayments =
      paymentsByStudent[participant.id] ||
      paymentsByStudent[participant.studentId] ||
      [];
    const fin = calculateStudentFinancials(participant, studentPayments);

    if (fin.isExempted) {
      exemptedCount++;
    } else {
      eligibleStudents++;
      totalTarget += fin.requiredAmount;
      totalCollected += fin.approvedPaid;
      remainingBalance += fin.remainingAmount;

      if (fin.isCoordinatorWaived) {
        coordinatorWaivedCount++;
        fullyPaidCount++; // Counted as paid for public statistics
      } else if (fin.isFullyPaid) {
        fullyPaidCount++;
      } else if (fin.isPartiallyPaid) {
        partiallyPaidCount++;
        pendingCount++;
      } else {
        pendingCount++;
      }
    }
  }

  const totalStudents = yearParticipants.length;
  const settledCount = fullyPaidCount; // includes coordinator waived

  const collectionPercentage =
    totalTarget > 0
      ? Math.min(100, Math.round((totalCollected / totalTarget) * 100 * 10) / 10)
      : 0;

  const yearLabels: Record<number, string> = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year",
  };

  return {
    year,
    yearLabel: yearLabels[year] || `Year ${year}`,
    totalStudents,
    eligibleStudents,
    fullyPaidCount,
    partiallyPaidCount,
    pendingCount,
    exemptedCount,
    coordinatorWaivedCount,
    settledCount,
    totalTarget,
    totalCollected,
    remainingBalance,
    collectionPercentage,
  };
}

/**
 * Calculates standard Class-Wise Statistics for Super Coordinator and View Coordinator portals.
 */
export function calculateClassWiseViewerStats(
  cls: ClassModel,
  participants: EventParticipantModel[],
  payments: PaymentModel[]
): ClassWiseViewerStatsModel {
  const classParticipants = participants.filter((p) => p.classId === cls.id);

  const paymentsByStudent: Record<string, PaymentModel[]> = {};
  for (const p of payments) {
    const key = p.participantId || p.studentId;
    if (!paymentsByStudent[key]) {
      paymentsByStudent[key] = [];
    }
    paymentsByStudent[key].push(p);
  }

  let eligibleStudents = 0;
  let exemptedCount = 0;
  let fullyPaidCount = 0;
  let partiallyPaidCount = 0;
  let pendingCount = 0;
  let coordinatorWaivedCount = 0;
  let totalTarget = 0;
  let totalCollected = 0;
  let remainingBalance = 0;

  for (const participant of classParticipants) {
    const studentPayments =
      paymentsByStudent[participant.id] ||
      paymentsByStudent[participant.studentId] ||
      [];
    const fin = calculateStudentFinancials(participant, studentPayments);

    if (fin.isExempted) {
      exemptedCount++;
    } else {
      eligibleStudents++;
      totalTarget += fin.requiredAmount;
      totalCollected += fin.approvedPaid;
      remainingBalance += fin.remainingAmount;

      if (fin.isCoordinatorWaived) {
        coordinatorWaivedCount++;
        fullyPaidCount++;
      } else if (fin.isFullyPaid) {
        fullyPaidCount++;
      } else if (fin.isPartiallyPaid) {
        partiallyPaidCount++;
        pendingCount++;
      } else {
        pendingCount++;
      }
    }
  }

  const totalStudents = classParticipants.length;
  const settledCount = fullyPaidCount;

  const collectionPercentage =
    totalTarget > 0
      ? Math.min(100, Math.round((totalCollected / totalTarget) * 100 * 10) / 10)
      : 0;

  return {
    classId: cls.id,
    className: cls.displayName,
    department: cls.department,
    year: cls.year,
    totalStudents,
    eligibleStudents,
    fullyPaidCount,
    partiallyPaidCount,
    pendingCount,
    exemptedCount,
    coordinatorWaivedCount,
    settledCount,
    totalTarget,
    totalCollected,
    remainingBalance,
    collectionPercentage,
  };
}

/**
 * Filter participants by a count mode without changing underlying amount math.
 */
export function filterParticipantsByCountMode(
  participants: EventParticipantModel[],
  payments: PaymentModel[],
  countMode: CountMode
): EventParticipantModel[] {
  if (countMode === "settled") {
    return participants.filter((p) => {
      const studentPayments = payments.filter(
        (pay) => pay.participantId === p.id || pay.studentId === p.studentId
      );
      const fin = calculateStudentFinancials(p, studentPayments);
      return fin.isFullyPaid || fin.isExempted;
    });
  }

  return participants.filter((p) => {
    const studentPayments = payments.filter(
      (pay) => pay.participantId === p.id || pay.studentId === p.studentId
    );
    const fin = calculateStudentFinancials(p, studentPayments);

    switch (countMode) {
      case "fully_paid":
        return fin.isFullyPaid && !fin.isExempted;
      case "paid_any":
        return fin.approvedPaid > 0;
      case "partially_paid":
        return fin.isPartiallyPaid;
      case "pending":
        return !fin.isFullyPaid && !fin.isExempted;
      case "not_paid":
        return fin.isUnpaid;
      default:
        return true;
    }
  });
}

/**
 * Reconcile Student Ledger Approved Collections with Central Receipts for an event/class.
 */
export interface ReconciliationReport {
  classId?: string;
  className?: string;
  studentLedgerApprovedTotal: number;
  centralReceiptTotal: number;
  cashReceived: number;
  digitalReceived: number;
  otherReceived: number;
  discrepancy: number;
  isReconciled: boolean;
  status: "reconciled" | "under_received" | "over_received";
}

export function calculateReconciliation(
  approvedStudentPayments: PaymentModel[],
  centralReceipts: CentralReceiptModel[],
  classId?: string
): ReconciliationReport {
  const filteredPayments = classId
    ? approvedStudentPayments.filter(
        (p) => p.classId === classId && p.status === "approved"
      )
    : approvedStudentPayments.filter((p) => p.status === "approved");

  const filteredReceipts = classId
    ? centralReceipts.filter((r) => r.classId === classId)
    : centralReceipts;

  const studentLedgerApprovedTotal = filteredPayments.reduce(
    (acc, curr) => acc + (curr.amount || 0),
    0
  );

  let centralReceiptTotal = 0;
  let cashReceived = 0;
  let digitalReceived = 0;
  let otherReceived = 0;

  for (const r of filteredReceipts) {
    if (r.status === "rolled_back") continue;
    centralReceiptTotal += r.totalAmount || 0;
    cashReceived += r.cashAmount || 0;
    digitalReceived += r.digitalAmount || 0;
    otherReceived += r.otherAmount || 0;
  }

  const discrepancy = centralReceiptTotal - studentLedgerApprovedTotal;
  const isReconciled = discrepancy === 0;
  const status =
    discrepancy === 0
      ? "reconciled"
      : discrepancy < 0
      ? "under_received"
      : "over_received";

  return {
    classId,
    studentLedgerApprovedTotal,
    centralReceiptTotal,
    cashReceived,
    digitalReceived,
    otherReceived,
    discrepancy,
    isReconciled,
    status,
  };
}

/**
 * Calculate Daily Closing balance.
 * Formula: Opening Balance + Actual Receipts - Actual Expenses = Closing Balance
 */
export function calculateDailyClosingBalance(
  openingBalance: number,
  moneyReceived: number,
  moneySpent: number
): number {
  return (openingBalance || 0) + (moneyReceived || 0) - (moneySpent || 0);
}
