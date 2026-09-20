import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchPayments,
  approvePayment,
  batchApprovePayments,
  declinePayment,
  rollbackPayment,
} from "../../services/paymentService";
import { fetchAllStudents } from "../../services/studentService";
import type { PaymentModel, StudentModel } from "../../types";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime, getISTDateString, formatISTDisplayDate } from "../../utils/formatters";
import {
  CheckSquare,
  XCircle,
  RotateCcw,
  CheckCheck,
  Search,
  Filter,
  Calendar,
} from "lucide-react";

export const ApprovalsManagement: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();

  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [filterTab, setFilterTab] = useState<"pending" | "approved" | "declined" | "rolled_back">("pending");
  const [searchTerm, setSearchTerm] = useState("");

  // FEATURE 5: Date Filter State (YYYY-MM-DD in IST)
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Class Filter State: "all" or specific classId(s)
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [classFilterMode, setClassFilterMode] = useState<"all" | "class_wise">("all");

  // Single Action States
  const [declineTarget, setDeclineTarget] = useState<PaymentModel | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [rollbackTarget, setRollbackTarget] = useState<PaymentModel | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");

  // FEATURE 2: Rollback processing tracking
  const [rollingBackIds, setRollingBackIds] = useState<Set<string>>(new Set());
  const [rollbackLoading, setRollbackLoading] = useState(false);

  // Batch Approval Confirmation Modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const loadData = async () => {
    if (!activeEvent) return;
    setLoading(true);
    try {
      const [pays, studs] = await Promise.all([
        fetchPayments(activeEvent.id),
        fetchAllStudents(),
      ]);
      setPayments(pays);
      setStudents(studs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setSelectedPaymentIds(new Set());
  }, [activeEvent?.id]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c.displayName]));

  const pendingPayments = payments.filter((p) => p.status === "pending_approval");
  const approvedPayments = payments.filter((p) => p.status === "approved");
  const declinedPayments = payments.filter((p) => p.status === "declined");
  const rolledBackPayments = payments.filter((p) => p.status === "rolled_back");

  const currentTabList =
    filterTab === "pending"
      ? pendingPayments
      : filterTab === "approved"
      ? approvedPayments
      : filterTab === "declined"
      ? declinedPayments
      : rolledBackPayments;

  // FEATURE 5: Apply Date Filter based on current tab's timestamp basis (IST timezone safe)
  const dateFilteredList = currentTabList.filter((p) => {
    if (!selectedDate) return true;
    if (filterTab === "pending") {
      return getISTDateString(p.addedAt) === selectedDate;
    } else if (filterTab === "approved") {
      return getISTDateString(p.approvedAt) === selectedDate;
    } else if (filterTab === "declined") {
      return getISTDateString(p.declinedAt || p.addedAt) === selectedDate;
    } else {
      return getISTDateString(p.rolledBackAt || p.approvedAt || p.addedAt) === selectedDate;
    }
  });

  // Apply Class Filter & Search Filter
  const classFilteredList = dateFilteredList.filter((p) => {
    if (selectedClassFilter === "all") return true;
    return p.classId === selectedClassFilter;
  });

  const filteredList = classFilteredList.filter((p) => {
    const student = studentMap.get(p.studentId);
    if (!searchTerm) return true;
    return (
      student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.registerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.addedByName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Calculate stats for current class & date filter
  const filteredPendingPayments = pendingPayments.filter((p) => {
    if (selectedClassFilter !== "all" && p.classId !== selectedClassFilter) return false;
    if (selectedDate && getISTDateString(p.addedAt) !== selectedDate) return false;
    return true;
  });
  const filteredPendingAmount = filteredPendingPayments.reduce(
    (acc, curr) => acc + (curr.amount || 0),
    0
  );

  const handleSelectAllPending = () => {
    if (selectedPaymentIds.size === filteredPendingPayments.length && filteredPendingPayments.length > 0) {
      setSelectedPaymentIds(new Set());
    } else {
      setSelectedPaymentIds(new Set(filteredPendingPayments.map((p) => p.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedPaymentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPaymentIds(next);
  };

  const handleApproveSingle = async (payment: PaymentModel) => {
    if (!userProfile) return;
    try {
      await approvePayment(payment.id, userProfile);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchApproveConfirm = async () => {
    if (!userProfile || selectedPaymentIds.size === 0) return;
    const targetPayments = pendingPayments.filter((p) => selectedPaymentIds.has(p.id));
    if (targetPayments.length === 0) return;

    setBatchLoading(true);
    try {
      await batchApprovePayments(targetPayments, userProfile);
      await loadData();
      setSelectedPaymentIds(new Set());
      setBatchModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleDeclineSubmit = async () => {
    if (!declineTarget || !userProfile) return;
    try {
      await declinePayment(declineTarget.id, declineReason, userProfile);
      await loadData();
      setDeclineTarget(null);
      setDeclineReason("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRollbackSubmit = async () => {
    if (!rollbackTarget || !userProfile || rollbackLoading) return;
    const targetId = rollbackTarget.id;
    setRollbackLoading(true);
    setRollingBackIds((prev) => new Set(prev).add(targetId));

    try {
      await rollbackPayment(targetId, rollbackReason, userProfile);
      await loadData();
      setRollbackTarget(null);
      setRollbackReason("");
    } catch (err: any) {
      console.error("Rollback failed:", err);
      alert(err.message || "Failed to rollback payment. Please try again.");
    } finally {
      setRollbackLoading(false);
      setRollingBackIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  // Selected batch calculations for explicit confirmation
  const selectedList = pendingPayments.filter((p) => selectedPaymentIds.has(p.id));
  const batchTotalAmount = selectedList.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const batchAffectedClasses = Array.from(
    new Set(selectedList.map((p) => classMap.get(p.classId) || "Unknown Class"))
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Super Coordinator Control
            </span>
            <span className="text-xs text-slate-400">• {activeEvent?.name}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Class-Wise Approvals Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review, verify, and batch-approve class coordinator submissions with class filtering and instant ledger updates.
          </p>
        </div>

        {filterTab === "pending" && selectedPaymentIds.size > 0 && (
          <button
            onClick={() => setBatchModalOpen(true)}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Batch Approve ({selectedPaymentIds.size} Payments)</span>
          </button>
        )}
      </div>

      {/* Class Filter Bar */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Class-Wise Filter
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setClassFilterMode("all");
                setSelectedClassFilter("all");
                setSelectedPaymentIds(new Set());
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedClassFilter === "all"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              All Pending Approvals
            </button>

            <button
              type="button"
              onClick={() => {
                setClassFilterMode("class_wise");
                if (selectedClassFilter === "all" && classes.length > 0) {
                  setSelectedClassFilter(classes[0].id);
                }
                setSelectedPaymentIds(new Set());
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                classFilterMode === "class_wise" && selectedClassFilter !== "all"
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Class-Wise Filter
            </button>
          </div>
        </div>

        {/* Class Selection Dropdown & Chips */}
        {classFilterMode === "class_wise" && (
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-semibold text-slate-300 uppercase shrink-0">
                Select Class:
              </label>
              <select
                value={selectedClassFilter}
                onChange={(e) => {
                  setSelectedClassFilter(e.target.value);
                  setSelectedPaymentIds(new Set());
                }}
                className="w-full sm:w-72 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Classes ({classes.length})</option>
                {classes.map((cls) => {
                  const classPendingCount = pendingPayments.filter((p) => p.classId === cls.id).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.displayName} ({cls.department} - Y{cls.year}) • {classPendingCount} pending
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Filter Class Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedClassFilter("all");
                  setSelectedPaymentIds(new Set());
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedClassFilter === "all"
                    ? "bg-emerald-500/30 text-emerald-200 border border-emerald-500/50"
                    : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                All Classes ({pendingPayments.length})
              </button>

              {classes.map((cls) => {
                const count = pendingPayments.filter((p) => p.classId === cls.id).length;
                const isSelected = selectedClassFilter === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      setSelectedClassFilter(cls.id);
                      setSelectedPaymentIds(new Set());
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-teal-500/30 text-teal-200 border border-teal-500/50"
                        : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    <span>{cls.displayName}</span>
                    {count > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Filter Metrics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Active Scope</span>
            <span className="text-xs font-bold text-slate-200 truncate block mt-0.5">
              {selectedClassFilter === "all" ? "All Classes" : classMap.get(selectedClassFilter) || selectedClassFilter}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Pending In Scope</span>
            <span className="text-xs font-bold font-mono text-amber-400 block mt-0.5">
              {filteredPendingPayments.length} Payments
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Pending Amount</span>
            <span className="text-xs font-bold font-mono text-emerald-400 block mt-0.5">
              {formatINR(filteredPendingAmount)}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Selected For Batch</span>
            <span className="text-xs font-bold font-mono text-teal-400 block mt-0.5">
              {selectedPaymentIds.size} Selected
            </span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => {
              setFilterTab("pending");
              setSelectedPaymentIds(new Set());
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              filterTab === "pending"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Awaiting Approval</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
              {filteredPendingPayments.length}
            </span>
          </button>

          <button
            onClick={() => {
              setFilterTab("approved");
              setSelectedPaymentIds(new Set());
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              filterTab === "approved"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Approved</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
              {approvedPayments.filter((p) => selectedClassFilter === "all" || p.classId === selectedClassFilter).length}
            </span>
          </button>

          <button
            onClick={() => {
              setFilterTab("declined");
              setSelectedPaymentIds(new Set());
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              filterTab === "declined"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Declined</span>
          </button>

          <button
            onClick={() => {
              setFilterTab("rolled_back");
              setSelectedPaymentIds(new Set());
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              filterTab === "rolled_back"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Rolled Back</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          {/* FEATURE 5: Date Filter Control */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-44">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedPaymentIds(new Set());
                }}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                title="Clear date filter (show all dates)"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                All Dates
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search student or coordinator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>{filterTab.toUpperCase().replace("_", " ")} ENTRIES ({filteredList.length}) • Scope: {selectedClassFilter === "all" ? "All Classes" : classMap.get(selectedClassFilter)}</span>
            {selectedDate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium normal-case tracking-normal">
                <Calendar className="w-3 h-3" />
                {formatISTDisplayDate(selectedDate)} (IST)
              </span>
            )}
          </h3>
        </div>

        {filteredList.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={CheckSquare}
              title={`No ${filterTab.replace("_", " ")} Payments`}
              description={`No payment records found for ${selectedClassFilter === "all" ? "the selected tab" : classMap.get(selectedClassFilter)}.`}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  {filterTab === "pending" && (
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredPendingPayments.length > 0 &&
                          selectedPaymentIds.size === filteredPendingPayments.length
                        }
                        onChange={handleSelectAllPending}
                        className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 font-mono">Amount</th>
                  <th className="py-3 px-4">Method & Ref</th>
                  <th className="py-3 px-4">Submitted By</th>
                  <th className="py-3 px-4">Date Logged</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredList.map((p) => {
                  const student = studentMap.get(p.studentId);
                  const isSelected = selectedPaymentIds.has(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isSelected ? "bg-emerald-950/20" : ""
                      }`}
                    >
                      {filterTab === "pending" && (
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(p.id)}
                            className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-100 block">
                          {student?.name || "Unknown Student"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {student?.registerNumber || p.studentId}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {classMap.get(p.classId) || p.classId}
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-sm text-emerald-400">
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-bold text-slate-300 block">
                          {p.paymentMethod}
                        </span>
                        {p.paymentReference && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Ref: {p.paymentReference}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {p.addedByName || "Coordinator"}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {formatDateTime(p.addedAt)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status === "pending_approval" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveSingle(p)}
                                title="Approve"
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeclineTarget(p)}
                                title="Decline"
                                className="p-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {p.status === "approved" && (
                            <button
                              type="button"
                              disabled={rollingBackIds.has(p.id) || rollbackLoading}
                              onClick={() => setRollbackTarget(p)}
                              title="Rollback Approved Payment"
                              className={`px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                                rollingBackIds.has(p.id) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                              }`}
                            >
                              {rollingBackIds.has(p.id) ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                  <span>Rolling Back...</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Rollback</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explicit Batch Approval Confirmation Modal */}
      {batchModalOpen && (
        <Modal
          isOpen={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          title="Confirm Batch Approval"
          subtitle="Explicit confirmation required before batch processing"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Selected Payments:</span>
                <span className="font-bold text-slate-100">{selectedList.length} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Approval Amount:</span>
                <span className="font-mono font-extrabold text-emerald-400 text-base">
                  {formatINR(batchTotalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Event:</span>
                <span className="font-bold text-slate-200">{activeEvent?.name}</span>
              </div>
              <div className="pt-2 border-t border-emerald-500/20">
                <span className="text-slate-400 block mb-1">Affected Classes:</span>
                <div className="flex flex-wrap gap-1.5">
                  {batchAffectedClasses.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to approve all {selectedList.length} payments? This will update each student's paid ledger and create an audit log.
            </p>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={batchLoading}
                onClick={handleBatchApproveConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {batchLoading ? "Approving..." : "Confirm Batch Approval"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Single Decline Modal */}
      {declineTarget && (
        <Modal
          isOpen={!!declineTarget}
          onClose={() => setDeclineTarget(null)}
          title="Decline Payment Submission"
          subtitle={`Amount: ${formatINR(declineTarget.amount)}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Reason for Declining (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Duplicate entry / Incorrect student chosen"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeclineTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeclineSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl cursor-pointer"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Single Rollback Modal */}
      {rollbackTarget && (
        <ConfirmDialog
          isOpen={!!rollbackTarget}
          onClose={() => {
            if (!rollbackLoading) {
              setRollbackTarget(null);
              setRollbackReason("");
            }
          }}
          onConfirm={handleRollbackSubmit}
          title="Rollback Approved Payment"
          message={`Are you sure you want to rollback the approved payment of ${formatINR(
            rollbackTarget.amount
          )}? This will subtract the amount from the student's paid ledger and create an immutable rollback audit trail.`}
          confirmLabel={rollbackLoading ? "Rolling Back..." : "Confirm Rollback"}
          loading={rollbackLoading}
          variant="warning"
        />
      )}
    </div>
  );
};
