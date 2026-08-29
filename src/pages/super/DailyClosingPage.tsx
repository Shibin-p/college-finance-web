import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchDailyClosings,
  createDailyClosing,
} from "../../services/closingService";
import { fetchExpenses } from "../../services/expenseService";
import { fetchCentralReceipts } from "../../services/receiptService";
import { calculateDailyClosingBalance } from "../../utils/calculations";
import type { DailyClosingModel, ExpenseModel, CentralReceiptModel } from "../../types";
import { Modal } from "../../components/common/Modal";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import {
  CalendarCheck,
  Plus,
  Lock,
} from "lucide-react";

export const DailyClosingPage: React.FC = () => {
  const { activeEvent } = useEvent();
  const { userProfile } = useAuth();

  const [closings, setDailyClosings] = useState<DailyClosingModel[]>([]);
  const [expenses, setExpenses] = useState<ExpenseModel[]>([]);
  const [centralReceipts, setCentralReceipts] = useState<CentralReceiptModel[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [moneyReceived, setMoneyReceived] = useState<string>("0");
  const [moneySpent, setMoneySpent] = useState<string>("0");
  const [remarks, setRemarks] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadData = async () => {
    if (!activeEvent) return;
    setLoading(true);
    try {
      const [closeList, exps, rcpts] = await Promise.all([
        fetchDailyClosings(activeEvent.id),
        fetchExpenses(activeEvent.id),
        fetchCentralReceipts(activeEvent.id),
      ]);
      setDailyClosings(closeList);
      setExpenses(exps);
      setCentralReceipts(rcpts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeEvent?.id]);

  const handleOpenModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDate(today);

    // Compute previous closing balance to use as opening balance
    const previousClosing = closings.length > 0 ? closings[0].closingBalance : 0;
    setOpeningBalance(String(previousClosing));

    // Calculate today's receipts and expenses
    const todayReceipts = centralReceipts
      .filter((r) => r.date === today)
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    const todayExpenses = expenses
      .filter((e) => {
        if (e.status !== "active") return false;
        const expDate = e.createdAt?.seconds
          ? new Date(e.createdAt.seconds * 1000).toISOString().slice(0, 10)
          : "";
        return expDate === today;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    setMoneyReceived(String(todayReceipts));
    setMoneySpent(String(todayExpenses));
    setCreateModalOpen(true);
  };

  const calculatedClosing = calculateDailyClosingBalance(
    parseFloat(openingBalance) || 0,
    parseFloat(moneyReceived) || 0,
    parseFloat(moneySpent) || 0
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !userProfile) return;
    setCreateError("");

    setCreateLoading(true);
    try {
      await createDailyClosing(
        {
          eventId: activeEvent.id,
          date,
          openingBalance: parseFloat(openingBalance) || 0,
          moneyReceived: parseFloat(moneyReceived) || 0,
          moneySpent: parseFloat(moneySpent) || 0,
          remarks,
        },
        userProfile
      );

      await loadData();
      setCreateModalOpen(false);
    } catch (err: any) {
      setCreateError(err.message || "Failed to finalize daily closing.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Daily Financial Closing Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Reconcile Opening Balance + Actual Receipts - Actual Expenses = Closing Balance on a daily basis.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Perform Daily Closing</span>
        </button>
      </div>

      {/* Closings Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Daily Closing Register ({closings.length})
          </h3>
        </div>

        {closings.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={CalendarCheck}
              title="No Daily Closings Yet"
              description="Execute your first daily closing to lock in end-of-day financial positions."
              actionLabel="Close Day"
              onAction={handleOpenModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 font-mono">Opening Balance</th>
                  <th className="py-3 px-4 font-mono">Receipts (+)</th>
                  <th className="py-3 px-4 font-mono">Expenses (-)</th>
                  <th className="py-3 px-4 font-mono">Closing Balance (=)</th>
                  <th className="py-3 px-4">Closed By</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {closings.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold font-mono text-slate-100 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{c.date}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {formatINR(c.openingBalance)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      +{formatINR(c.moneyReceived)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-rose-400">
                      -{formatINR(c.moneySpent)}
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-sm text-teal-400">
                      {formatINR(c.closingBalance)}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{c.closedByName || "Super Admin"}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {formatDateTime(c.closedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Closing Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Perform Daily Financial Closing"
        subtitle="Calculated using Opening Balance + Actual Receipts - Actual Expenses"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {createError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Closing Date *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                Opening (₹)
              </label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                Receipts (₹)
              </label>
              <input
                type="number"
                value={moneyReceived}
                onChange={(e) => setMoneyReceived(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                Expenses (₹)
              </label>
              <input
                type="number"
                value={moneySpent}
                onChange={(e) => setMoneySpent(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-rose-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-300 block font-semibold">
                Final Closing Balance
              </span>
              <span className="text-[11px] text-slate-400">
                Formula: Opening + Receipts - Expenses
              </span>
            </div>
            <span className="text-xl font-mono font-extrabold text-emerald-400">
              {formatINR(calculatedClosing)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Day 1 closing verified by Head Coordinator"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2 cursor-pointer"
            >
              {createLoading ? "Locking Day..." : "Finalize Daily Closing"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
