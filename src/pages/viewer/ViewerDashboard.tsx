import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchEventParticipants, fetchAllStudents } from "../../services/studentService";
import { fetchPayments } from "../../services/paymentService";
import { fetchExpenses } from "../../services/expenseService";
import { fetchAdjustments } from "../../services/adjustmentService";
import {
  calculateAggregateTotals,
  resolvePublicStudentStatus,
} from "../../utils/calculations";
import type {
  EventParticipantModel,
  PaymentModel,
  ExpenseModel,
  AdjustmentModel,
  StudentModel,
} from "../../types";
import { StatCard } from "../../components/common/StatCard";
import { EmptyState } from "../../components/common/EmptyState";
import { StatusBadge } from "../../components/common/StatusBadge";
import { formatINR } from "../../utils/formatters";
import {
  Building2,
  TrendingUp,
  Coins,
  CreditCard,
  Calendar,
  Search,
  Users,
  PieChart,
  Tag,
} from "lucide-react";

export const ViewerDashboard: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { viewerScope, viewerPermissions } = usePermissions();

  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [expenses, setExpenses] = useState<ExpenseModel[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentModel[]>([]);
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [loading, setLoading] = useState(false);

  // Student search state
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    if (!activeEvent) return;
    const load = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [
          fetchEventParticipants(activeEvent.id),
          fetchPayments(activeEvent.id),
          fetchAdjustments(activeEvent.id),
        ];

        if (viewerPermissions.canViewExpenses) {
          promises.push(fetchExpenses(activeEvent.id));
        }

        if (viewerPermissions.canViewStudentCollectionStatus) {
          promises.push(fetchAllStudents());
        }

        const [parts, pays, adjs, exps, studs] = await Promise.all(promises);
        setParticipants(parts || []);
        setPayments(pays || []);
        setAdjustments(adjs || []);
        if (viewerPermissions.canViewExpenses && exps) {
          setExpenses(exps);
        }
        if (viewerPermissions.canViewStudentCollectionStatus && studs) {
          setStudents(studs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [
    activeEvent?.id,
    viewerPermissions.canViewExpenses,
    viewerPermissions.canViewExpenseCategories,
    viewerPermissions.canViewStudentCollectionStatus,
  ]);

  const totals = calculateAggregateTotals(
    participants,
    payments,
    adjustments,
    viewerPermissions.canViewExpenses ? expenses : []
  );

  // Category breakdown calculation
  const categoryTotals: Record<string, number> = {};
  if (viewerPermissions.canViewExpenses && viewerPermissions.canViewExpenseCategories) {
    for (const exp of expenses) {
      if (exp.status === "active") {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + (exp.amount || 0);
      }
    }
  }

  const matchedStudents = studentSearch.trim()
    ? students
        .filter(
          (s) =>
            s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
            s.registerNumber.toLowerCase().includes(studentSearch.toLowerCase())
        )
        .slice(0, 10)
    : [];

  if (!activeEvent && !loading) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Calendar}
          title="No Active Event"
          description="There are currently no active college events to view."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            Read-Only Executive View
          </span>
          <span className="text-xs text-slate-400">• {activeEvent?.name}</span>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Scope: {viewerScope === "specific_class" ? "Class Scope" : "College Overview"}
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          College Collection Overview
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time aggregated financial figures and executive collection metrics.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Required"
          value={formatINR(totals.totalRequired)}
          subtitle={`${totals.eligibleStudents} eligible students`}
          icon={Coins}
          variant="slate"
        />

        <StatCard
          title="Total Received"
          value={formatINR(totals.adjustedTotalAmount)}
          subtitle={`${totals.collectionPercentage}% collected`}
          icon={TrendingUp}
          variant="emerald"
          trend={`${totals.collectionPercentage}%`}
        />

        {viewerPermissions.canViewExpenses ? (
          <>
            <StatCard
              title="Total Expenditure"
              value={formatINR(totals.totalExpenses)}
              subtitle="All active event expenses"
              icon={CreditCard}
              variant="rose"
            />

            <StatCard
              title="Net Event Balance"
              value={formatINR(totals.balanceRemaining)}
              subtitle="Received minus expenditures"
              icon={Building2}
              variant="blue"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Fully Paid"
              value={totals.fullyPaidCount}
              subtitle="Students with settled balance"
              icon={Building2}
              variant="blue"
            />

            <StatCard
              title="Pending Students"
              value={totals.pendingCount}
              subtitle="Students with balance due"
              icon={CreditCard}
              variant="amber"
            />
          </>
        )}
      </div>

      {/* Collection Progress Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-300 uppercase tracking-wider">
            Overall College Collection Target
          </span>
          <span className="text-emerald-400 font-mono text-sm">
            {totals.collectionPercentage}%
          </span>
        </div>

        <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, totals.collectionPercentage)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>{totals.fullyPaidCount} Students Fully Settled</span>
          <span>{totals.pendingCount} Students Pending</span>
        </div>
      </div>

      {/* Category-Wise Expense Breakdown (If permitted) */}
      {viewerPermissions.canViewExpenses && viewerPermissions.canViewExpenseCategories && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4 text-teal-400" />
                <span>Category-Wise Expense Breakdown</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Itemized distribution of expenditures across event categories.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400">
              Total: {formatINR(totals.totalExpenses)}
            </span>
          </div>

          {Object.keys(categoryTotals).length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No category-wise expenditure recorded yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(categoryTotals).map(([catName, amt]) => {
                const percent =
                  totals.totalExpenses > 0
                    ? Math.round((amt / totals.totalExpenses) * 100)
                    : 0;
                return (
                  <div
                    key={catName}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-teal-400" />
                        <span>{catName}</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{percent}%</span>
                    </div>
                    <div className="text-base font-extrabold font-mono text-rose-400">
                      {formatINR(amt)}
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Student Status Lookup (Permitted Viewers Only) */}
      {viewerPermissions.canViewStudentCollectionStatus && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Student Payment Status Lookup</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Search a student by name or register number to verify their public settlement state.
            </p>
          </div>

          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Type student name or register number..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {matchedStudents.length > 0 && (
            <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
              {matchedStudents.map((s) => {
                const part = participants.find((p) => p.studentId === s.id);
                const sPays = payments.filter((p) => p.studentId === s.id);
                const publicStatus = resolvePublicStudentStatus(part, sPays);
                const cls = classes.find((c) => c.id === s.classId);

                const statusVariant =
                  publicStatus === "Paid"
                    ? "fully_paid"
                    : publicStatus === "Partially Paid"
                    ? "partially_paid"
                    : publicStatus === "Exempted"
                    ? "exempted"
                    : "not_paid";

                return (
                  <div
                    key={s.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-100 block">{s.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Reg: {s.registerNumber} • Class: {cls?.displayName || s.classId}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={statusVariant} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
