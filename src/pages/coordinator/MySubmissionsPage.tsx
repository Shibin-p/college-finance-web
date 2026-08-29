import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { fetchPayments } from "../../services/paymentService";
import { fetchAllStudents } from "../../services/studentService";
import type { PaymentModel, StudentModel } from "../../types";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import { CheckSquare, Search } from "lucide-react";

export const MySubmissionsPage: React.FC = () => {
  const { activeEvent } = useEvent();
  const { userProfile } = useAuth();

  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

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

                  <div className="flex items-center gap-3">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
