import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchStudentsByClass,
  ensureEventParticipantsForClass,
} from "../../services/studentService";
import { fetchPayments, addPayment } from "../../services/paymentService";
import { calculateStudentFinancials } from "../../utils/calculations";
import type {
  StudentModel,
  EventParticipantModel,
  PaymentModel,
  PaymentMethod,
} from "../../types";
import { formatINR } from "../../utils/formatters";
import {
  Coins,
  Search,
  CheckCircle2,
  User,
  AlertCircle,
  ArrowRight,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export const ClassCollectionPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();
  const { assignedClassIds } = usePermissions();
  const navigate = useNavigate();

  const [assignedClassId, setAssignedClassId] = useState<string>("");
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);

  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentModel | null>(null);
  const [amount, setAmount] = useState<string>("500");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (assignedClassIds.length > 0) {
      setAssignedClassId(assignedClassIds[0]);
    } else if (classes.length > 0 && userProfile?.role === "super_coordinator") {
      setAssignedClassId(classes[0].id);
    }
  }, [assignedClassIds, classes, userProfile?.role]);

  const loadData = async () => {
    if (!activeEvent || !assignedClassId) return;
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
    }
  };

  useEffect(() => {
    loadData();
  }, [activeEvent?.id, assignedClassId]);

  const matchedStudents = studentSearch.trim()
    ? students.filter(
        (s) =>
          s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
          s.registerNumber.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : [];

  const selectedParticipant = selectedStudent
    ? participants.find((p) => p.studentId === selectedStudent.id)
    : null;

  const studentPayments = selectedStudent
    ? payments.filter((p) => p.studentId === selectedStudent.id)
    : [];

  const financials = selectedParticipant
    ? calculateStudentFinancials(selectedParticipant, studentPayments)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedParticipant || !activeEvent || !userProfile) return;
    setErrorMessage("");
    setSuccessMessage("");

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage("Please enter a valid positive payment amount.");
      return;
    }

    setSubmitting(true);
    try {
      await addPayment(
        {
          eventId: activeEvent.id,
          participantId: selectedParticipant.id,
          studentId: selectedStudent.id,
          classId: assignedClassId,
          amount: numAmount,
          paymentMethod,
          paymentReference,
          autoApprove: false,
        },
        userProfile
      );

      setSuccessMessage(
        `Successfully logged ₹${numAmount} for ${selectedStudent.name}. Submitted for Super Coordinator approval!`
      );
      await loadData();
      setSelectedStudent(null);
      setStudentSearch("");
      setAmount("500");
      setPaymentReference("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 text-center space-y-1">
        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 inline-flex mb-1">
          <Coins className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Quick Payment Collection
        </h1>
        <p className="text-xs text-slate-400">
          Search student by register number or name to record physical cash or UPI installments.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => navigate("/coordinator/submissions")}
            className="text-xs font-bold underline text-emerald-200 hover:text-white shrink-0 cursor-pointer"
          >
            View Submissions
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-950/60 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Payment Form Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        {/* Step 1: Select Student */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
            1. Select Student *
          </label>

          {selectedStudent ? (
            <>
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{selectedStudent.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Reg: <strong className="text-slate-200">{selectedStudent.registerNumber}</strong> • Due:{" "}
                      <strong className="text-amber-400">
                        {formatINR(financials?.remainingAmount)}
                      </strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* FEATURE 1: Already Paid Alert (Non-blocking warning for extra payment) */}
              {financials && financials.approvedPaid >= (financials.requiredAmount || 0) && (financials.requiredAmount || 0) > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-start gap-3 mt-3 animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-200 text-sm">
                      Already Paid {formatINR(financials.approvedPaid)}
                    </p>
                    <p className="text-[11px] text-amber-300/80 leading-relaxed">
                      This student has already paid {formatINR(financials.approvedPaid)} (required event target: {formatINR(financials.requiredAmount)}). You can still continue to record an additional/extra payment below.
                    </p>
                  </div>
                </div>
              )}

              {financials && financials.isPartiallyPaid && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-300 text-xs flex items-center justify-between mt-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Already Paid: <strong className="font-mono text-blue-200">{formatINR(financials.approvedPaid)}</strong> of {formatINR(financials.requiredAmount)}</span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-300 font-semibold">Remaining Due: {formatINR(financials.remainingAmount)}</span>
                </div>
              )}

              {/* CASE 2: Already Awaiting Approval Alert (Non-blocking warning) */}
              {financials && financials.pendingApprovalAmount > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-start gap-3 mt-3 animate-in fade-in">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-200 text-sm">
                      Already Awaiting Approval — {formatINR(financials.pendingApprovalAmount)}
                    </p>
                    <p className="text-[11px] text-amber-300/80 leading-relaxed">
                      This student already has {formatINR(financials.pendingApprovalAmount)} awaiting Super Coordinator approval. You can still continue to record an additional/extra payment below.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Type student name or register number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {matchedStudents.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800 bg-slate-900/90">
                  {matchedStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudent(s);
                        setStudentSearch("");
                      }}
                      className="w-full p-3 text-left hover:bg-slate-800/60 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-xs text-slate-100">{s.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono block">
                          {s.registerNumber}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Payment Details */}
        {selectedStudent && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                2. Amount Collected (₹) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xl font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />

              {/* Quick buttons */}
              <div className="flex gap-2 mt-2">
                {[100, 250, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(String(amt))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                3. Payment Method *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["cash", "upi", "bank_transfer", "other"] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
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
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                4. Reference / Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. UPI transaction reference / Cash slip"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Total Target for Student:</span>
                <span className="font-mono text-slate-200">
                  {formatINR(financials?.requiredAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Already Approved:</span>
                <span className="font-mono text-emerald-400">
                  {formatINR(financials?.approvedPaid)}
                </span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-800 text-slate-200">
                <span>Remaining Balance Due:</span>
                <span className="font-mono text-amber-400">
                  {formatINR(financials?.remainingAmount)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-sm rounded-xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Submitting Record...</span>
                </>
              ) : (
                <span>Submit Payment Record</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
