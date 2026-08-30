import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchExpenses } from "../../services/expenseService";
import { fetchPayments } from "../../services/paymentService";
import { fetchAdjustments } from "../../services/adjustmentService";
import { fetchEventParticipants } from "../../services/studentService";
import { calculateAggregateTotals } from "../../utils/calculations";
import type { ExpenseModel, PaymentModel, AdjustmentModel, EventParticipantModel } from "../../types";
import { StatCard } from "../../components/common/StatCard";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import {
  CreditCard,
  Building2,
  TrendingUp,
  PieChart,
  Tag,
  Lock,
  Calendar,
} from "lucide-react";

export const ViewerExpensesPage: React.FC = () => {
  const { activeEvent } = useEvent();
  const { viewerScope, viewerPermissions } = usePermissions();

  const [expenses, setExpenses] = useState<ExpenseModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (!activeEvent || !viewerPermissions.canViewExpenses) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [exps, pays, parts, adjs] = await Promise.all([
          fetchExpenses(activeEvent.id),
          fetchPayments(activeEvent.id),
          fetchEventParticipants(activeEvent.id),
          fetchAdjustments(activeEvent.id),
        ]);
        setExpenses(exps || []);
        setPayments(pays || []);
        setParticipants(parts || []);
        setAdjustments(adjs || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeEvent?.id, viewerPermissions.canViewExpenses]);

  // If permission is not granted
  if (!viewerPermissions.canViewExpenses) {
    return (
      <div className="py-12 max-w-md mx-auto">
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-100">
            Expenditure Access Restricted
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            The Super Coordinator has not enabled expenditure viewing permission for your View Coordinator account.
          </p>
        </div>
      </div>
    );
  }

  if (!activeEvent && !loading) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Calendar}
          title="No Active Event"
          description="There are currently no active events to display expenses for."
        />
      </div>
    );
  }

  const activeExpenses = expenses.filter((e) => e.status === "active");
  const totals = calculateAggregateTotals(participants, payments, adjustments, activeExpenses);

  // Category breakdown calculation
  const categoryTotals: Record<string, number> = {};
  for (const exp of activeExpenses) {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + (exp.amount || 0);
  }

  const categoryNames = Object.keys(categoryTotals);
  const filteredExpenses = activeExpenses.filter((e) => {
    if (selectedCategory === "all") return true;
    return e.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
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
          Event Expenditures Overview
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Authorized executive financial expenditure summary and category distributions.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Expenditure"
          value={formatINR(totals.totalExpenses)}
          subtitle={`${activeExpenses.length} active outlay records`}
          icon={CreditCard}
          variant="rose"
        />

        <StatCard
          title="Total Funds Received"
          value={formatINR(totals.adjustedTotalAmount)}
          subtitle={`${totals.collectionPercentage}% of collection target`}
          icon={TrendingUp}
          variant="emerald"
        />

        <StatCard
          title="Net Event Balance"
          value={formatINR(totals.balanceRemaining)}
          subtitle="Remaining funds after expenses"
          icon={Building2}
          variant="blue"
        />
      </div>

      {/* Category Breakdown Section (Only if canViewExpenseCategories is true) */}
      {viewerPermissions.canViewExpenseCategories ? (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4 text-teal-400" />
                <span>Category-Wise Outlay Breakdown</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Itemized distribution across approved event expense categories.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400">
              Total Spent: {formatINR(totals.totalExpenses)}
            </span>
          </div>

          {categoryNames.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No categorized expenditures recorded for this event yet.
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

          {/* Itemized List Filtered by Category */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Itemized Expense Log ({filteredExpenses.length})
              </h4>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-semibold">Filter:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">All Categories ({categoryNames.length})</option>
                  {categoryNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Item Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right font-mono">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {formatDateTime(exp.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-100">{exp.item}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-teal-300 border border-slate-800">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                        {formatINR(exp.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 text-center space-y-2">
          <p className="text-xs text-slate-400">
            Overall expenditure totals are active. Category-wise expense breakdown has been restricted by the Super Coordinator.
          </p>
        </div>
      )}
    </div>
  );
};
