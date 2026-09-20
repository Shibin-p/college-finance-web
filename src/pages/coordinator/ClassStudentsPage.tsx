import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchStudentsByClass,
  ensureEventParticipantsForClass,
} from "../../services/studentService";
import { fetchPayments, addPayment } from "../../services/paymentService";
import {
  calculateStudentFinancials,
  filterParticipantsByCountMode,
} from "../../utils/calculations";
import type {
  StudentModel,
  EventParticipantModel,
  PaymentModel,
  PaymentMethod,
  CountMode,
} from "../../types";
import { Modal } from "../../components/common/Modal";
import { CountModeFilter } from "../../components/common/CountModeFilter";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import {
  Users,
  Search,
  Plus,
  History,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";

export const ClassStudentsPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();
  const { assignedClassIds } = usePermissions();

  const [assignedClassId, setAssignedClassId] = useState<string>("");
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [countMode, setCountMode] = useState<CountMode>("fully_paid");

  // Payment Entry Modal
  const [paymentTarget, setPaymentTarget] = useState<{
    student: StudentModel;
    participant: EventParticipantModel;
  } | null>(null);
  const [amount, setAmount] = useState<string>("500");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // History Modal
  const [historyTarget, setHistoryTarget] = useState<{
    student: StudentModel;
    participant: EventParticipantModel;
  } | null>(null);

  useEffect(() => {
    if (assignedClassIds.length > 0) {
      setAssignedClassId(assignedClassIds[0]);
    } else if (classes.length > 0 && userProfile?.role === "super_coordinator") {
      setAssignedClassId(classes[0].id);
    }
  }, [assignedClassIds, classes, userProfile?.role]);

  const loadData = async () => {
    if (!activeEvent || !assignedClassId) return;
    setLoading(true);
    try {
      const studs = await fetchStudentsByClass(assignedClassId);
      setStudents(studs);

      const parts = await ensureEventParticipantsForClass(
        activeEvent.id,
        assignedClassId,
        activeEvent.defaultTargetAmount,
        activeEvent.targetAmountEnabled,
        studs
      );
      setParticipants(parts);

      const pays = await fetchPayments(activeEvent.id, assignedClassId);
      setPayments(pays);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeEvent?.id, assignedClassId]);

  const classDetails = classes.find((c) => c.id === assignedClassId);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget || !activeEvent || !userProfile) return;
    setPaymentError("");

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setPaymentError("Please enter a valid positive payment amount.");
      return;
    }

    setPaymentLoading(true);
    try {
      await addPayment(
        {
          eventId: activeEvent.id,
          participantId: paymentTarget.participant.id,
          studentId: paymentTarget.student.id,
          classId: assignedClassId,
          amount: numAmount,
          paymentMethod,
          paymentReference,
          autoApprove: false,
        },
        userProfile
      );

      await loadData();
      setPaymentTarget(null);
      setAmount("500");
      setPaymentReference("");
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment.");
    } finally {
      setPaymentLoading(false);
    }
  };

  // Counts for filter
  let fullyPaid = 0,
    paidAny = 0,
    partiallyPaid = 0,
    pending = 0,
    notPaid = 0,
    settled = 0;

  for (const part of participants) {
    const studentPayments = payments.filter((p) => p.participantId === part.id || p.studentId === part.studentId);
    const fin = calculateStudentFinancials(part, studentPayments);
    if (fin.isExempted) {
      settled++;
    } else {
      if (fin.isFullyPaid) {
        fullyPaid++;
        settled++;
      } else if (fin.isPartiallyPaid) {
        partiallyPaid++;
        pending++;
      } else if (fin.isUnpaid) {
        notPaid++;
        pending++;
      }
      if (fin.approvedPaid > 0 || fin.pendingApprovalAmount > 0) {
        paidAny++;
      }
    }
  }

  const filteredParticipants = filterParticipantsByCountMode(participants, payments, countMode);
  const filteredStudentIds = new Set(filteredParticipants.map((p) => p.studentId));

  const displayedStudents = students.filter(
    (s) =>
      filteredStudentIds.has(s.id) &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.registerNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Bar */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {classDetails?.displayName}
            </span>
            <span className="text-xs text-slate-400">• {students.length} Students</span>
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            Class Student Roster
          </h1>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name or reg no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Count Mode Filter */}
      <div className="glass-panel p-3.5 rounded-2xl border border-slate-800">
        <CountModeFilter
          value={countMode}
          onChange={setCountMode}
          counts={{
            fully_paid: fullyPaid,
            paid_any: paidAny,
            partially_paid: partiallyPaid,
            pending: pending,
            not_paid: notPaid,
            settled: settled,
          }}
        />
      </div>

      {/* Mobile-First Student Cards List */}
      <div className="space-y-3">
        {displayedStudents.length === 0 && !loading ? (
          <div className="py-12 glass-panel rounded-3xl border border-slate-800">
            <EmptyState
              icon={Users}
              title="No Matching Students"
              description="No students in this class match the selected filter or search term."
            />
          </div>
        ) : (
          displayedStudents.map((student) => {
            const participant = participants.find((p) => p.studentId === student.id);
            const studentPayments = payments.filter(
              (p) => p.participantId === participant?.id || p.studentId === student.id
            );
            const fin = calculateStudentFinancials(participant, studentPayments);

            return (
              <div
                key={student.id}
                className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-emerald-400">
                      {student.registerNumber}
                    </span>
                    <StatusBadge
                      status={
                        fin.isExempted
                          ? "exempted"
                          : fin.isFullyPaid
                          ? "fully_paid"
                          : fin.isPartiallyPaid
                          ? "partially_paid"
                          : "not_paid"
                      }
                      size="sm"
                    />
                  </div>
                  <h3 className="font-bold text-sm text-slate-100 mt-1">{student.name}</h3>

                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span>
                      Required: <strong className="text-slate-200">{formatINR(fin.requiredAmount)}</strong>
                    </span>
                    <span>
                      Paid: <strong className="text-emerald-400">{formatINR(fin.approvedPaid)}</strong>
                    </span>
                    {!fin.isExempted && fin.remainingAmount > 0 && (
                      <span>
                        Due: <strong className="text-amber-400">{formatINR(fin.remainingAmount)}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (participant) {
                        setPaymentTarget({ student, participant });
                        setAmount(fin.remainingAmount > 0 ? String(fin.remainingAmount) : "500");
                      }
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Collect</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (participant) setHistoryTarget({ student, participant });
                    }}
                    title="History"
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentTarget && (
        <Modal
          isOpen={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          title="Collect Payment / Installment"
          subtitle={`Student: ${paymentTarget.student.name} (${paymentTarget.student.registerNumber})`}
          maxWidth="md"
        >
          {(() => {
            const targetPayments = payments.filter(
              (p) => p.participantId === paymentTarget.participant.id || p.studentId === paymentTarget.student.id
            );
            const targetFin = calculateStudentFinancials(paymentTarget.participant, targetPayments);
            const isFullySettled = targetFin.approvedPaid >= (targetFin.requiredAmount || 0) && (targetFin.requiredAmount || 0) > 0;

            return (
              <form onSubmit={handleAddPayment} className="space-y-4">
                {paymentError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                    {paymentError}
                  </div>
                )}

                {/* FEATURE 1: Already Paid Alert (Non-blocking warning) */}
                {isFullySettled && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-start gap-3 animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-200">
                        Already Paid {formatINR(targetFin.approvedPaid)}
                      </p>
                      <p className="text-[11px] text-amber-300/80 leading-relaxed">
                        This student has already paid {formatINR(targetFin.approvedPaid)} (required event target: {formatINR(targetFin.requiredAmount)}). You can still continue to record an additional/extra payment below.
                      </p>
                    </div>
                  </div>
                )}

                {targetFin.isPartiallyPaid && (
                  <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Paid: <strong className="font-mono text-blue-200">{formatINR(targetFin.approvedPaid)}</strong> of {formatINR(targetFin.requiredAmount)}</span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-300 font-semibold">Due: {formatINR(targetFin.remainingAmount)}</span>
                  </div>
                )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Amount (₹) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />

              {/* Optional Quick Denomination Buttons */}
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
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
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
                UPI Reference / Receipt Note (Optional)
              </label>
              <input
                type="text"
                placeholder="Reference number or note..."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                Payment will be submitted for Super Coordinator approval and added to your submissions queue.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPaymentTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={paymentLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
              >
                {paymentLoading ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
            </form>
          );
        })()}
      </Modal>
      )}

      {/* History Modal */}
      {historyTarget && (
        <Modal
          isOpen={!!historyTarget}
          onClose={() => setHistoryTarget(null)}
          title="Student Payment History"
          subtitle={`${historyTarget.student.name} (${historyTarget.student.registerNumber})`}
          maxWidth="md"
        >
          {(() => {
            const studentPays = payments.filter((p) => p.studentId === historyTarget.student.id);
            if (studentPays.length === 0) {
              return (
                <p className="text-xs text-slate-500 py-6 text-center italic">
                  No payment history recorded for this student.
                </p>
              );
            }

            return (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {studentPays.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-400">
                          {formatINR(p.amount)}
                        </span>
                        <span className="text-slate-400 uppercase font-semibold text-[10px]">
                          via {p.paymentMethod}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {formatDateTime(p.addedAt)}
                      </p>
                    </div>
                    <StatusBadge status={p.status} size="sm" />
                  </div>
                ))}
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};
