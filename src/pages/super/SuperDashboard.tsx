import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { fetchEventParticipants } from "../../services/studentService";
import { fetchPayments } from "../../services/paymentService";
import { fetchExpenses } from "../../services/expenseService";
import { fetchAdjustments } from "../../services/adjustmentService";
import { fetchCentralReceipts } from "../../services/receiptService";
import {
  calculateAggregateTotals,
  calculateReconciliation,
} from "../../utils/calculations";
import type {
  EventParticipantModel,
  PaymentModel,
  ExpenseModel,
  AdjustmentModel,
  CentralReceiptModel,
  CountMode,
} from "../../types";
import { StatCard } from "../../components/common/StatCard";
import { CountModeFilter } from "../../components/common/CountModeFilter";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR } from "../../utils/formatters";
import {
  Coins,
  CreditCard,
  Clock,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  Scale,
  Calendar,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export const SuperDashboard: React.FC = () => {
  const { activeEvent } = useEvent();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [expenses, setExpenses] = useState<ExpenseModel[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentModel[]>([]);
  const [centralReceipts, setCentralReceipts] = useState<CentralReceiptModel[]>([]);
  const [countMode, setCountMode] = useState<CountMode>("fully_paid");

  const loadDashboardData = async () => {
    if (!activeEvent) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [partsData, paysData, expData, adjData, rcptData] = await Promise.all([
        fetchEventParticipants(activeEvent.id),
        fetchPayments(activeEvent.id),
        fetchExpenses(activeEvent.id),
        fetchAdjustments(activeEvent.id),
        fetchCentralReceipts(activeEvent.id),
      ]);
      setParticipants(partsData);
      setPayments(paysData);
      setExpenses(expData);
      setAdjustments(adjData);
      setCentralReceipts(rcptData);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeEvent?.id]);

  const totals = calculateAggregateTotals(participants, payments, adjustments, expenses);
  const reconciliation = calculateReconciliation(payments, centralReceipts);
  const pendingApprovals = payments.filter((p) => p.status === "pending_approval");

  if (!activeEvent && !loading) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Calendar}
          title="No Active Event Found"
          description="Create your first college event to start managing student finances, collections, and approvals."
          actionLabel="Create First Event"
          onAction={() => navigate("/super/events")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Event Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {activeEvent?.status?.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: {activeEvent?.id}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {activeEvent?.name}
          </h1>
          {activeEvent?.description && (
            <p className="text-xs text-slate-400 mt-1 max-w-xl">{activeEvent.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate("/super/collection")}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Coins className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
          <button
            onClick={() => navigate("/super/approvals")}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2 relative cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>Approvals</span>
            {pendingApprovals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Actionable Alerts Bar */}
      {(pendingApprovals.length > 0 || !reconciliation.isReconciled) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pendingApprovals.length > 0 && (
            <div
              onClick={() => navigate("/super/approvals")}
              className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:bg-amber-950/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-200">
                    {pendingApprovals.length} Payment(s) Awaiting Approval
                  </h4>
                  <p className="text-[11px] text-amber-400/80">
                    Total pending: {formatINR(totals.totalPendingApproval)}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </div>
          )}

          {!reconciliation.isReconciled && (
            <div
              onClick={() => navigate("/super/reconciliation")}
              className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between cursor-pointer hover:bg-rose-950/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 rounded-xl text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-200">
                    Reconciliation Discrepancy: {formatINR(Math.abs(reconciliation.discrepancy))}
                  </h4>
                  <p className="text-[11px] text-rose-400/80">
                    Central receipts do not match approved student collection
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-rose-400" />
            </div>
          )}
        </div>
      )}

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Required"
          value={formatINR(totals.totalRequired)}
          subtitle={`${totals.eligibleStudents} eligible students`}
          icon={Coins}
          variant="slate"
          loading={loading}
        />

        <StatCard
          title="Total Received (Approved)"
          value={formatINR(totals.totalApprovedReceived)}
          subtitle={`${totals.collectionPercentage}% collected`}
          icon={TrendingUp}
          variant="emerald"
          trend={`${totals.collectionPercentage}%`}
          loading={loading}
        />

        <StatCard
          title="Total Outstanding"
          value={formatINR(totals.totalOutstanding)}
          subtitle={`${totals.pendingCount} students pending`}
          icon={AlertTriangle}
          variant="amber"
          loading={loading}
        />

        <StatCard
          title="Net Balance"
          value={formatINR(totals.balanceRemaining)}
          subtitle={`Expenses: ${formatINR(totals.totalExpenses)}`}
          icon={CreditCard}
          variant="blue"
          loading={loading}
        />
      </div>

      {/* Collection Count-Definition Filter Section */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Student Collection Breakdown
            </h3>
            <p className="text-xs text-slate-400">
              Filter student counts without altering actual monetary totals
            </p>
          </div>

          <CountModeFilter
            value={countMode}
            onChange={setCountMode}
            counts={{
              fully_paid: totals.fullyPaidCount,
              paid_any: totals.paidAnyCount,
              partially_paid: totals.partiallyPaidCount,
              pending: totals.pendingCount,
              not_paid: totals.notPaidCount,
              settled: totals.settledCount,
            }}
          />
        </div>

        {/* Count Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <p className="text-[11px] font-semibold text-slate-400">Fully Paid</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-1">{totals.fullyPaidCount}</p>
            <p className="text-[10px] text-slate-500">
              {totals.totalStudents > 0 ? Math.round((totals.fullyPaidCount / totals.totalStudents) * 100) : 0}% of class
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <p className="text-[11px] font-semibold text-slate-400">Partially Paid</p>
            <p className="text-xl font-extrabold text-amber-400 mt-1">{totals.partiallyPaidCount}</p>
            <p className="text-[10px] text-slate-500">Contributed partially</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <p className="text-[11px] font-semibold text-slate-400">Unpaid / Zero</p>
            <p className="text-xl font-extrabold text-rose-400 mt-1">{totals.notPaidCount}</p>
            <p className="text-[10px] text-slate-500">No approved payment</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <p className="text-[11px] font-semibold text-slate-400">Exempted</p>
            <p className="text-xl font-extrabold text-blue-400 mt-1">{totals.exemptedStudents}</p>
            <p className="text-[10px] text-slate-500">Approved exemption</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <p className="text-[11px] font-semibold text-slate-400">Waived</p>
            <p className="text-xl font-extrabold text-teal-400 mt-1">{totals.waivedStudents}</p>
            <p className="text-[10px] text-slate-500">Coordinator waiver</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
            <p className="text-[11px] font-semibold text-slate-400">Total Enrolled</p>
            <p className="text-xl font-extrabold text-slate-200 mt-1">{totals.totalStudents}</p>
            <p className="text-[10px] text-slate-500">All participants</p>
          </div>
        </div>
      </div>

      {/* Financial Reconciliation & Adjustments Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Central Receipt Reconciliation Card */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Receipt Reconciliation</h3>
              </div>
              <StatusBadge status={reconciliation.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400">Approved Student Ledger</p>
                <p className="text-lg font-bold text-slate-100 font-mono mt-1">
                  {formatINR(reconciliation.studentLedgerApprovedTotal)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400">Central Receipts Handed In</p>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-1">
                  {formatINR(reconciliation.centralReceiptTotal)}
                </p>
              </div>
            </div>

            {reconciliation.discrepancy !== 0 && (
              <p className="text-xs text-rose-400 font-medium mb-3">
                Discrepancy: {formatINR(reconciliation.discrepancy)} ({reconciliation.status.replace("_", " ")})
              </p>
            )}
          </div>

          <button
            onClick={() => navigate("/super/reconciliation")}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Open Reconciliation Engine</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Adjustments & Displayed Totals */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-100">Financial Adjustments</h3>
              <span className="text-xs font-mono text-slate-400">
                {adjustments.length} adjustment(s)
              </span>
            </div>

            <div className="space-y-2.5 my-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Raw Approved Collection:</span>
                <span className="font-mono font-bold text-slate-200">
                  {formatINR(totals.totalApprovedReceived)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Sum of Adjustments:</span>
                <span className={`font-mono font-bold ${totals.totalAmountAdjustments >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {totals.totalAmountAdjustments >= 0 ? "+" : ""}{formatINR(totals.totalAmountAdjustments)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                <span className="font-bold text-slate-200">Adjusted Total Displayed:</span>
                <span className="font-mono font-extrabold text-emerald-400 text-sm">
                  {formatINR(totals.adjustedTotalAmount)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate("/super/adjustments")}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Manage Finance Adjustments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
