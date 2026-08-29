import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchStudentsByClass,
  ensureEventParticipantsForClass,
} from "../../services/studentService";
import {
  fetchPayments,
  addPayment,
  approvePayment,
  declinePayment,
} from "../../services/paymentService";
import { calculateStudentFinancials, calculateAggregateTotals } from "../../utils/calculations";
import type {
  StudentModel,
  EventParticipantModel,
  PaymentModel,
  PaymentMethod,
} from "../../types";
import { Modal } from "../../components/common/Modal";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Layers,
  PhoneCall,
  Plus,
  Check,
  X,
  CheckSquare,
} from "lucide-react";

export const CollectionAssistantDashboard: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();
  const { crossClassCapabilities, crossClassAuthorizedClassIds, loading: permsLoading } =
    usePermissions();

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"pending" | "collect" | "approvals">("pending");
  const [searchTerm, setSearchTerm] = useState("");

  // Payment Modal
  const [paymentTarget, setPaymentTarget] = useState<{
    student: StudentModel;
    participant: EventParticipantModel;
  } | null>(null);
  const [amount, setAmount] = useState("500");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(
    null
  );

  // Decline Reason Modal
  const [declineTarget, setDeclineTarget] = useState<PaymentModel | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Filter authorized classes
  const authorizedClasses = classes.filter((c) =>
    crossClassAuthorizedClassIds.includes(c.id)
  );

  useEffect(() => {
    if (authorizedClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(authorizedClasses[0].id);
    }
  }, [crossClassAuthorizedClassIds, classes]);

  const loadData = async () => {
    if (!activeEvent || !selectedClassId) return;
    setLoading(true);
    try {
      const studs = await fetchStudentsByClass(selectedClassId);
      setStudents(studs);

      const parts = await ensureEventParticipantsForClass(
        activeEvent.id,
        selectedClassId,
        activeEvent.defaultTargetAmount,
        activeEvent.targetAmountEnabled,
        studs
      );
      setParticipants(parts);

      const pays = await fetchPayments(activeEvent.id, selectedClassId);
      setPayments(pays);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeEvent?.id, selectedClassId]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget || !activeEvent || !userProfile) return;
    setFeedback(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: "error", msg: "Please enter a valid positive payment amount." });
      return;
    }

    setSubmitting(true);
    try {
      await addPayment(
        {
          eventId: activeEvent.id,
          participantId: paymentTarget.participant.id,
          studentId: paymentTarget.student.id,
          classId: selectedClassId,
          amount: numAmount,
          paymentMethod,
          paymentReference: paymentRef,
          autoApprove: false,
        },
        userProfile
      );

      setFeedback({
        type: "success",
        msg: `Logged ₹${numAmount} for ${paymentTarget.student.name}. Submitted for approval.`,
      });
      await loadData();
      setPaymentTarget(null);
      setAmount("500");
      setPaymentRef("");
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Failed to record payment." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (pay: PaymentModel) => {
    if (!userProfile) return;
    if (pay.addedBy === userProfile.uid) {
      setFeedback({
        type: "error",
        msg: "Self-approval blocked: You cannot approve a payment you personally submitted.",
      });
      return;
    }

    try {
      await approvePayment(pay.id, userProfile);
      await loadData();
      setFeedback({ type: "success", msg: `Payment of ₹${pay.amount} approved.` });
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Failed to approve." });
    }
  };

  const handleDecline = async () => {
    if (!declineTarget || !userProfile) return;
    try {
      await declinePayment(declineTarget.id, declineReason, userProfile);
      await loadData();
      setDeclineTarget(null);
      setDeclineReason("");
      setFeedback({ type: "success", msg: "Payment declined." });
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Failed to decline." });
    }
  };

  // Student calculations
  const pendingStudentList = students
    .map((s) => {
      const part = participants.find((p) => p.studentId === s.id);
      const sPays = payments.filter((p) => p.studentId === s.id);
      const fin = calculateStudentFinancials(part, sPays);
      return { student: s, participant: part, fin };
    })
    .filter((item) => !item.fin.isFullyPaid && !item.fin.isExempted);

  const pendingPayments = payments.filter((p) => p.status === "pending_approval");
  const aggTotals = calculateAggregateTotals(participants, payments);
  const selectedClassObj = classes.find((c) => c.id === selectedClassId);

  if (authorizedClasses.length === 0 && !permsLoading) {
    return (
      <div className="py-12 max-w-md mx-auto">
        <EmptyState
          icon={Layers}
          title="No Classes Authorized"
          description="You have Cross-Class Collection Assistant access, but no classes have been authorized by the Super Coordinator yet."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-teal-500/20 bg-gradient-to-r from-teal-950/30 to-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>Collection Assistant Workspace</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {authorizedClasses.length} Authorized Classes
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Cross-Class Collection Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Assist in field collection and track pending student balances across authorized classes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Class:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3.5 py-2 bg-slate-900 border border-teal-500/40 rounded-xl text-xs font-bold text-teal-300 focus:outline-none focus:border-teal-400 cursor-pointer shadow-inner"
            >
              {authorizedClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.displayName} ({cls.department})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/60 border border-rose-500/30 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Mini KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Pending In Class</p>
          <p className="text-lg font-bold font-mono text-amber-400 mt-0.5">
            {pendingStudentList.length} Students
          </p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Collected</p>
          <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
            {formatINR(aggTotals.totalApprovedReceived)}
          </p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Due Balance</p>
          <p className="text-lg font-bold font-mono text-slate-200 mt-0.5">
            {formatINR(aggTotals.totalOutstanding)}
          </p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Awaiting Approval</p>
          <p className="text-lg font-bold font-mono text-teal-400 mt-0.5">
            {pendingPayments.length} Records
          </p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            tab === "pending"
              ? "border-teal-400 text-teal-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Pending Students ({pendingStudentList.length})</span>
        </button>

        {crossClassCapabilities.canHandlePendingApprovals && (
          <button
            type="button"
            onClick={() => setTab("approvals")}
            className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              tab === "approvals"
                ? "border-teal-400 text-teal-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Pending Approvals ({pendingPayments.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: Pending Students Roster */}
      {tab === "pending" && (
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {selectedClassObj?.displayName} Pending Call List
              </h3>
              <p className="text-[11px] text-slate-400">
                Identify students with remaining contributions and record collections
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search student or reg..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
          </div>

          {pendingStudentList.length === 0 && !loading ? (
            <div className="p-8">
              <EmptyState
                icon={CheckCircle2}
                title="All Students Settled"
                description={`All students in ${selectedClassObj?.displayName || "this class"} have fully paid their required target.`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Register No</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 font-mono">Target</th>
                    <th className="py-3 px-4 font-mono">Paid</th>
                    <th className="py-3 px-4 font-mono">Due Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pendingStudentList
                    .filter(
                      (item) =>
                        !searchTerm ||
                        item.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.student.registerNumber.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(({ student, participant, fin }) => (
                      <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                          {student.registerNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-100">{student.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {formatINR(fin.requiredAmount)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {formatINR(fin.approvedPaid)}
                        </td>
                        <td className="py-3 px-4 font-mono font-extrabold text-amber-400">
                          {formatINR(fin.remainingAmount)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            status={fin.isPartiallyPaid ? "partially_paid" : "not_paid"}
                            size="sm"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          {crossClassCapabilities.canAddPayment && participant && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentTarget({ student, participant });
                                setAmount(
                                  fin.remainingAmount > 0 ? String(fin.remainingAmount) : "500"
                                );
                              }}
                              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-all flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Collect</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Pending Approvals (Only if explicitly granted) */}
      {tab === "approvals" && crossClassCapabilities.canHandlePendingApprovals && (
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-800/80">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {selectedClassObj?.displayName} Pending Verification Queue
            </h3>
            <p className="text-[11px] text-slate-400">
              Verify payments submitted by other coordinators (Self-submitted payments cannot be self-approved)
            </p>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={CheckCircle2}
                title="No Pending Approvals"
                description="All payments in this class are verified and settled."
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {pendingPayments.map((p) => {
                const s = students.find((stud) => stud.id === p.studentId);
                const isSelf = p.addedBy === userProfile?.uid;

                return (
                  <div
                    key={p.id}
                    className="p-4 hover:bg-slate-800/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm text-emerald-400">
                          {formatINR(p.amount)}
                        </span>
                        <span className="text-slate-400 uppercase font-semibold text-[10px]">
                          via {p.paymentMethod}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="font-bold text-slate-100">{s?.name || "Student"}</span>
                        <span className="text-slate-400 font-mono">({s?.registerNumber})</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Submitted on {formatDateTime(p.addedAt)} by {p.addedByName || "Coordinator"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelf ? (
                        <span className="text-[11px] text-amber-400 font-medium italic">
                          Self-approval prevented
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setDeclineTarget(p)}
                            className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-semibold"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApprove(p)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1 cursor-pointer font-bold"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Collect Payment Modal */}
      {paymentTarget && (
        <Modal
          isOpen={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          title="Record Student Contribution"
          subtitle={`Student: ${paymentTarget.student.name} (${paymentTarget.student.registerNumber}) • Class: ${selectedClassObj?.displayName}`}
          maxWidth="md"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Payment Amount (₹) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-teal-400 focus:outline-none focus:border-teal-500"
              />

              {crossClassCapabilities.canAddInstallment && (
                <div className="flex gap-2 mt-2">
                  {[100, 250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(String(amt))}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-colors cursor-pointer"
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Payment Method *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["cash", "upi", "bank_transfer", "other"] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                      paymentMethod === m
                        ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {m.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Reference / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="UPI ref or Cash note"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPaymentTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Payment Record"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Decline Reason Modal */}
      {declineTarget && (
        <Modal
          isOpen={!!declineTarget}
          onClose={() => setDeclineTarget(null)}
          title="Decline Payment Record"
          subtitle={`Payment: ${formatINR(declineTarget.amount)}`}
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDecline();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Decline Reason *
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Amount mismatch / Duplicate entry"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
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
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl flex items-center gap-2 cursor-pointer"
              >
                Confirm Decline
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
