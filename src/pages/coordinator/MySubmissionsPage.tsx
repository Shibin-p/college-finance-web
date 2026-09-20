import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { fetchPayments, cancelPaymentSubmission } from "../../services/paymentService";
import { fetchAllStudents } from "../../services/studentService";
import type { PaymentModel, StudentModel } from "../../types";
import { StatusBadge } from "../../components/common/StatusBadge";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import { CheckSquare, Search, XCircle } from "lucide-react";

export const MySubmissionsPage: React.FC = () => {
  const { activeEvent } = useEvent();
  const { userProfile } = useAuth();

  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // FEATURE 4: Cancel Submission state
  const [cancelTarget, setCancelTarget] = useState<PaymentModel | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const handleCancelSubmit = async () => {
    if (!cancelTarget || !userProfile || cancelLoading) return;
    const targetId = cancelTarget.id;
    setCancelLoading(true);
    setCancellingIds((prev) => new Set(prev).add(targetId));

    try {
      await cancelPaymentSubmission(targetId, userProfile);
      await loadData();
      setCancelTarget(null);
    } catch (err: any) {
      console.error("Failed to cancel submission:", err);
      alert(err.message || "Failed to cancel payment submission. Please try again.");
    } finally {
      setCancelLoading(false);
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  const loadData = async () => {
    if (!activeEvent || !userProfile) return;
    setLoading(true);
    try {
      const [allPays, studs] = await Promise.all([
        fetchPayments(activeEvent.id),
        fetchAllStudents(),
      ]);
      const myPays = allPays.filter((p) => p.addedBy === userProfile.uid);
      setPayments(myPays);
      setStudents(studs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeEvent?.id, userProfile?.uid]);

  const studentMap = new Map(students.map((s) => [s.id, s]));

  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const student = studentMap.get(p.studentId);
    if (searchTerm) {
      const matchName = student?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchReg = student?.registerNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRef = p.paymentReference?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName && !matchReg && !matchRef) return false;
    }
    return true;
  });

  const pendingCount = payments.filter((p) => p.status === "pending_approval").length;
  const approvedCount = payments.filter((p) => p.status === "approved").length;
  const cancelledCount = payments.filter((p) => p.status === "cancelled").length;
  const approvedTotal = payments
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            My Payment Submissions
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track approval state and status of all student payments submitted by you.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <span className="text-slate-400">Approved: </span>
            <span className="font-mono font-bold text-emerald-400">{formatINR(approvedTotal)}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            All ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending_approval")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "pending_approval"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Awaiting Approval ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("approved")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "approved"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("cancelled")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "cancelled"
                ? "bg-slate-800 text-slate-200 border border-slate-700"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Cancelled ({cancelledCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search student or ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Submissions List */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        {filteredPayments.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={CheckSquare}
              title="No Submissions Found"
              description="You have no recorded payments matching this filter."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredPayments.map((p) => {
              const student = studentMap.get(p.studentId);
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
                      <span className="text-slate-400 uppercase font-semibold text-[11px]">
                        via {p.paymentMethod}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="font-bold text-slate-100">{student?.name || "Student"}</span>
                      <span className="text-slate-400 font-mono">({student?.registerNumber})</span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1">
                      Submitted on {formatDateTime(p.addedAt)}
                    </p>
                    {p.paymentReference && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        Ref: {p.paymentReference}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={p.status} />
                    {p.status === "pending_approval" && (
                      <button
                        type="button"
                        disabled={cancellingIds.has(p.id) || cancelLoading}
                        onClick={() => setCancelTarget(p)}
                        className={`px-2.5 py-1 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 rounded-xl transition-all flex items-center gap-1.5 ${
                          cancellingIds.has(p.id) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        {cancellingIds.has(p.id) ? (
                          <>
                            <div className="w-3 h-3 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
                            <span>Cancelling...</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel Submission</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Payment Submission Confirmation Modal */}
      {cancelTarget && (
        <ConfirmDialog
          isOpen={!!cancelTarget}
          onClose={() => {
            if (!cancelLoading) setCancelTarget(null);
          }}
          onConfirm={handleCancelSubmit}
          title="Cancel Payment Submission?"
          message={
            <div className="space-y-2">
              <p>
                Are you sure you want to cancel this payment submission of{" "}
                <strong className="text-white">{formatINR(cancelTarget.amount)}</strong> for{" "}
                <strong className="text-white">{studentMap.get(cancelTarget.studentId)?.name || "Student"}</strong>?
              </p>
              <p className="text-xs text-slate-400">
                This will remove the item from the Super Coordinator's pending approval queue. The submission record will remain in your history marked as cancelled.
              </p>
            </div>
          }
          confirmLabel={cancelLoading ? "Cancelling..." : "Confirm Cancellation"}
          loading={cancelLoading}
          variant="danger"
        />
      )}
    </div>
  );
};
