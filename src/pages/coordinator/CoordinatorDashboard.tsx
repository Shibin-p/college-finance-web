import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchStudentsByClass,
  ensureEventParticipantsForClass,
} from "../../services/studentService";
import { fetchPayments } from "../../services/paymentService";
import {
  calculateStudentFinancials,
  calculateAggregateTotals,
} from "../../utils/calculations";
import type {
  StudentModel,
  EventParticipantModel,
  PaymentModel,
} from "../../types";
import { StatCard } from "../../components/common/StatCard";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import {
  Coins,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Plus,
  ArrowRight,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export const CoordinatorDashboard: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();
  const { assignedClassIds, permissions, loading: permsLoading } = usePermissions();
  const navigate = useNavigate();

  const [assignedClassId, setAssignedClassId] = useState<string>("");
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [loading, setLoading] = useState(false);

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
  const totals = calculateAggregateTotals(participants, payments);

  // Filter pending reminders (students with remaining balance > 0 and not exempted)
  const pendingStudents = students
    .map((s) => {
      const part = participants.find((p) => p.studentId === s.id);
      const studentPays = payments.filter((p) => p.studentId === s.id);
      const fin = calculateStudentFinancials(part, studentPays);
      return { student: s, fin };
    })
    .filter((item) => !item.fin.isFullyPaid && !item.fin.isExempted);

  // Coordinator's recent submissions
  const mySubmissions = payments
    .filter((p) => p.addedBy === userProfile?.uid)
    .slice(0, 5);

  if (permsLoading || (loading && !classDetails)) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400 font-medium">Loading class workspace...</p>
      </div>
    );
  }

  if (!assignedClassId && !permsLoading) {
    return (
      <div className="py-12 max-w-md mx-auto">
        <EmptyState
          icon={AlertTriangle}
          title="No Class Assigned"
          description={`You do not have an active class assignment for "${activeEvent?.name || "this event"}". Please contact your Super Coordinator to configure your assignment.`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile-First Header Card */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {classDetails?.displayName || "Assigned Class"}
            </span>
            <span className="text-xs text-slate-400">• {activeEvent?.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Class Collection Portal
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Collect student funds, enter partial installments, and track approval status.
          </p>
        </div>

        {permissions.canAddPayment && (
          <button
            onClick={() => navigate("/coordinator/collection")}
            className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Payment</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Target Amount"
          value={formatINR(totals.totalRequired)}
          subtitle={`${totals.totalStudents} total students`}
          icon={Coins}
          variant="slate"
        />

        <StatCard
          title="Total Collected"
          value={formatINR(totals.totalApprovedReceived)}
          subtitle={`${totals.collectionPercentage}% collected`}
          icon={TrendingUp}
          variant="emerald"
          trend={`${totals.collectionPercentage}%`}
        />

        <StatCard
          title="Pending Total"
          value={formatINR(totals.totalOutstanding)}
          subtitle={`${totals.pendingCount} students`}
          icon={AlertTriangle}
          variant="amber"
        />

        <StatCard
          title="Fully Paid"
          value={`${totals.fullyPaidCount} / ${totals.eligibleStudents}`}
          subtitle={`${totals.partiallyPaidCount} partially paid`}
          icon={CheckCircle}
          variant="blue"
        />
      </div>

      {/* Two Column Layout on Desktop: Pending Reminders & Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Students Reminders Card */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Pending Collection List ({pendingStudents.length})</span>
              </h3>
              <button
                onClick={() => navigate("/coordinator/students")}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
              >
                View Roster
              </button>
            </div>

            {pendingStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="font-bold text-slate-200">Class Collection 100% Settled!</p>
                <p className="text-[11px] text-slate-500 mt-0.5">All students are fully paid or exempted.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {pendingStudents.slice(0, 6).map(({ student, fin }) => (
                  <div
                    key={student.id}
                    className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">{student.name}</div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {student.registerNumber}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-amber-400">
                        {formatINR(fin.remainingAmount)} due
                      </p>
                      <span className="text-[10px] text-slate-500">
                        Paid: {formatINR(fin.approvedPaid)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate("/coordinator/students")}
            className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Open Class Student Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* My Submissions Tracker */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>My Recent Submissions</span>
              </h3>
              <button
                onClick={() => navigate("/coordinator/submissions")}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
              >
                All Submissions
              </button>
            </div>

            {mySubmissions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                You have not submitted any payment records yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {mySubmissions.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs"
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
            )}
          </div>

          <button
            onClick={() => navigate("/coordinator/submissions")}
            className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>View Full Submissions History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
