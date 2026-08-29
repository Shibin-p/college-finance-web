import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchStudentsByClass,
  ensureEventParticipantsForClass,
  setExemption,
  setCoordinatorWaiver,
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
  Coins,
  Search,
  Plus,
  ShieldCheck,
  History,
  Sliders,
} from "lucide-react";

export const CollectionManagement: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [countMode, setCountMode] = useState<CountMode>("fully_paid");

  // Payment Modal
  const [paymentTarget, setPaymentTarget] = useState<{
    student: StudentModel;
    participant: EventParticipantModel;
  } | null>(null);
  const [amount, setAmount] = useState<string>("500");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Exemption Modal
  const [exemptionTarget, setExemptionTarget] = useState<{
    student: StudentModel;
    participant: EventParticipantModel;
  } | null>(null);
  const [exemptionReason, setExemptionReason] = useState("");
  const [exemptionLoading, setExemptionLoading] = useState(false);

  // Waiver Modal
  const [waiverTarget, setWaiverTarget] = useState<{
    student: StudentModel;
    participant: EventParticipantModel;
  } | null>(null);
  const [waiverAmount, setWaiverAmount] = useState<string>("500");
  const [waiverLoading, setWaiverLoading] = useState(false);

  // History Modal
  const [historyTarget, setHistoryTarget] = useState<{
    student: StudentModel;
    participant: EventParticipantModel;
  } | null>(null);

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes]);

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

  const selectedClass = classes.find((c) => c.id === selectedClassId);

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
          classId: selectedClassId,
          amount: numAmount,
          paymentMethod,
          paymentReference,
          autoApprove: true,
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

  const handleExemptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exemptionTarget || !userProfile) return;

    setExemptionLoading(true);
    try {
      await setExemption(
        exemptionTarget.participant.id,
        !exemptionTarget.participant.exemption,
        exemptionReason,
        userProfile
      );
      await loadData();
      setExemptionTarget(null);
      setExemptionReason("");
    } catch (err) {
      console.error(err);
    } finally {
      setExemptionLoading(false);
    }
  };

  const handleWaiverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiverTarget || !userProfile) return;

    setWaiverLoading(true);
    try {
      const numWaiver = parseFloat(waiverAmount) || 0;
      await setCoordinatorWaiver(
        waiverTarget.participant.id,
        !waiverTarget.participant.coordinatorWaiver,
        numWaiver,
        userProfile
      );
      await loadData();
      setWaiverTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setWaiverLoading(false);
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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Fund Collection & Student Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Log direct payments, partial installments, exemptions, and coordinator waivers.
          </p>
        </div>
      </div>

      {/* Class Selector & Search & Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Class:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.displayName} ({cls.department})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search student or reg no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Count Mode Filter Bar */}
      <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
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

      {/* Collection Roster Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            {selectedClass?.displayName} Ledger ({displayedStudents.length} Students)
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Target / Student: {formatINR(activeEvent?.defaultTargetAmount)}
          </span>
        </div>

        {displayedStudents.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={Coins}
              title="No Matching Students"
              description="No student records match the selected count-definition filter or search query."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Register No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 font-mono">Required</th>
                  <th className="py-3 px-4 font-mono">Approved Paid</th>
                  <th className="py-3 px-4 font-mono">Pending Appr.</th>
                  <th className="py-3 px-4 font-mono">Remaining</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedStudents.map((student) => {
                  const participant = participants.find((p) => p.studentId === student.id);
                  const studentPayments = payments.filter(
                    (p) => p.participantId === participant?.id || p.studentId === student.id
                  );
                  const fin = calculateStudentFinancials(participant, studentPayments);

                  return (
                    <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">
                        {student.registerNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-100">{student.name}</span>
                        {fin.isCoordinatorWaived && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300">
                            Waived (₹{participant?.coordinatorWaiverAmount || fin.requiredAmount})
                          </span>
                        )}
                        {fin.isExempted && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                            Exempt: {participant?.exemptionReason || "Approved"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {formatINR(fin.requiredAmount)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {formatINR(fin.approvedPaid)}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-400">
                        {fin.pendingApprovalAmount > 0 ? formatINR(fin.pendingApprovalAmount) : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">
                        {fin.isExempted ? "₹0 (Exempt)" : formatINR(fin.remainingAmount)}
                      </td>
                      <td className="py-3 px-4">
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
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (participant) {
                                setPaymentTarget({ student, participant });
                                setAmount(fin.remainingAmount > 0 ? String(fin.remainingAmount) : "500");
                              }
                            }}
                            title="Collect Payment"
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Collect</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (participant) setHistoryTarget({ student, participant });
                            }}
                            title="Payment History"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (participant) setExemptionTarget({ student, participant });
                            }}
                            title={fin.isExempted ? "Remove Exemption" : "Grant Exemption"}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (participant) setWaiverTarget({ student, participant });
                            }}
                            title={fin.isCoordinatorWaived ? "Remove Coordinator Waiver" : "Apply Coordinator Waiver"}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5 text-teal-400" />
                          </button>
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

      {/* Record Payment Modal */}
      {paymentTarget && (
        <Modal
          isOpen={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          title="Record Payment / Installment"
          subtitle={`Student: ${paymentTarget.student.name} (${paymentTarget.student.registerNumber})`}
          maxWidth="md"
        >
          <form onSubmit={handleAddPayment} className="space-y-4">
            {paymentError && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                {paymentError}
              </div>
            )}

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
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />

              {/* Free numerical input + optional quick denomination shortcuts */}
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
                Reference / Receipt Note (Optional)
              </label>
              <input
                type="text"
                placeholder="UPI ref number, cash receipt note..."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
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
                disabled={paymentLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
              >
                {paymentLoading ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* History Modal */}
      {historyTarget && (
        <Modal
          isOpen={!!historyTarget}
          onClose={() => setHistoryTarget(null)}
          title="Payment History"
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
                        {formatDateTime(p.addedAt)} by {p.addedByName || "Coordinator"}
                      </p>
                      {p.paymentReference && (
                        <p className="text-[10px] text-slate-400 font-mono">Ref: {p.paymentReference}</p>
                      )}
                    </div>
                    <StatusBadge status={p.status} size="sm" />
                  </div>
                ))}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Exemption Modal */}
      {exemptionTarget && (
        <Modal
          isOpen={!!exemptionTarget}
          onClose={() => setExemptionTarget(null)}
          title={
            exemptionTarget.participant.exemption
              ? "Remove Student Exemption"
              : "Grant Student Exemption"
          }
          subtitle={`Student: ${exemptionTarget.student.name} (${exemptionTarget.student.registerNumber})`}
          maxWidth="md"
        >
          <form onSubmit={handleExemptionSubmit} className="space-y-4">
            {!exemptionTarget.participant.exemption && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                  Exemption Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Special college sponsorship / Medical leave"
                  value={exemptionReason}
                  onChange={(e) => setExemptionReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {exemptionTarget.participant.exemption && (
              <p className="text-xs text-slate-300">
                Are you sure you want to remove the exemption for this student? Their required collection target will be restored.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setExemptionTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={exemptionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2 cursor-pointer"
              >
                {exemptionLoading ? "Saving..." : "Confirm Exemption"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Waiver Modal */}
      {waiverTarget && (
        <Modal
          isOpen={!!waiverTarget}
          onClose={() => setWaiverTarget(null)}
          title={
            waiverTarget.participant.coordinatorWaiver
              ? "Remove Coordinator Waiver"
              : "Apply Coordinator Waiver"
          }
          subtitle={`Student: ${waiverTarget.student.name} (${waiverTarget.student.registerNumber})`}
          maxWidth="md"
        >
          <form onSubmit={handleWaiverSubmit} className="space-y-4">
            <p className="text-xs text-slate-400">
              Coordinator waivers appear as <strong>Paid</strong> to view coordinators and other coordinators, while preserving the underlying waiver record for the Super Coordinator and excluding it from money received calculations.
            </p>

            {!waiverTarget.participant.coordinatorWaiver && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                  Waiver Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={waiverAmount}
                  onChange={(e) => setWaiverAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setWaiverTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={waiverLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl flex items-center gap-2 cursor-pointer"
              >
                {waiverLoading ? "Saving..." : "Save Waiver"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
