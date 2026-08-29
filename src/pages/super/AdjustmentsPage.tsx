import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchAdjustments,
  createAdjustment,
} from "../../services/adjustmentService";
import { fetchPayments } from "../../services/paymentService";
import { fetchEventParticipants } from "../../services/studentService";
import { calculateAggregateTotals } from "../../utils/calculations";
import type { AdjustmentModel, PaymentModel, EventParticipantModel } from "../../types";
import { Modal } from "../../components/common/Modal";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import { Sliders, Plus } from "lucide-react";

export const AdjustmentsPage: React.FC = () => {
  const { activeEvent } = useEvent();
  const { userProfile } = useAuth();

  const [adjustments, setAdjustments] = useState<AdjustmentModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [amountAdjustment, setAmountAdjustment] = useState<string>("0");
  const [countAdjustment, setCountAdjustment] = useState<string>("0");
  const [description, setDescription] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadData = async () => {
    if (!activeEvent) return;
    setLoading(true);
    try {
      const [adj, pays, parts] = await Promise.all([
        fetchAdjustments(activeEvent.id),
        fetchPayments(activeEvent.id),
        fetchEventParticipants(activeEvent.id),
      ]);
      setAdjustments(adj);
      setPayments(pays);
      setParticipants(parts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeEvent?.id]);

  const totals = calculateAggregateTotals(participants, payments, adjustments);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !userProfile) return;
    setCreateError("");

    const numAmt = parseFloat(amountAdjustment) || 0;
    const numCnt = parseInt(countAdjustment, 10) || 0;

    if (numAmt === 0 && numCnt === 0) {
      setCreateError("Please enter an amount or count adjustment value.");
      return;
    }

    setCreateLoading(true);
    try {
      await createAdjustment(
        {
          eventId: activeEvent.id,
          amountAdjustment: numAmt,
          countAdjustment: numCnt,
          description,
        },
        userProfile
      );

      await loadData();
      setCreateModalOpen(false);
      setAmountAdjustment("0");
      setCountAdjustment("0");
      setDescription("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create adjustment.");
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
            Financial & Count Adjustments
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Apply college-level manual adjustments while keeping raw underlying student transactions intact.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Adjustment</span>
        </button>
      </div>

      {/* Math Demonstration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Raw Approved Total
          </p>
          <p className="text-2xl font-extrabold font-mono text-slate-100 mt-1">
            {formatINR(totals.totalApprovedReceived)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Calculated from student payment docs
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Net Adjustments
          </p>
          <p
            className={`text-2xl font-extrabold font-mono mt-1 ${
              totals.totalAmountAdjustments >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {totals.totalAmountAdjustments >= 0 ? "+" : ""}
            {formatINR(totals.totalAmountAdjustments)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Count adjustment: {totals.totalCountAdjustments >= 0 ? "+" : ""}{totals.totalCountAdjustments}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Final Displayed Total
          </p>
          <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
            {formatINR(totals.adjustedTotalAmount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Shown on reports and executive dashboards
          </p>
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Adjustment Audit Register
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {adjustments.length} adjustment entries
          </span>
        </div>

        {adjustments.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={Sliders}
              title="No Adjustments Recorded"
              description="If your event requires special college-level waivers or bulk figure adjustments, log them here."
              actionLabel="Add Adjustment"
              onAction={() => setCreateModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Amount Adjustment</th>
                  <th className="py-3 px-4">Count Adjustment</th>
                  <th className="py-3 px-4">Description / Reason</th>
                  <th className="py-3 px-4">Added By</th>
                  <th className="py-3 px-4">Date Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-extrabold text-sm">
                      <span className={adj.amountAdjustment >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {adj.amountAdjustment >= 0 ? "+" : ""}{formatINR(adj.amountAdjustment)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {adj.countAdjustment >= 0 ? "+" : ""}{adj.countAdjustment}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{adj.description || "—"}</td>
                    <td className="py-3 px-4 text-slate-400">{adj.addedByName || "Super Admin"}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateTime(adj.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Adjustment Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Financial / Count Adjustment"
        subtitle="Applies an event-level adjustment to final figures while preserving raw transaction records"
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
              Amount Adjustment (₹)
            </label>
            <input
              type="number"
              step="any"
              placeholder="e.g. -500 or +1000"
              value={amountAdjustment}
              onChange={(e) => setAmountAdjustment(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Use negative values to deduct (e.g. -500)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Count Adjustment (Students)
            </label>
            <input
              type="number"
              step="1"
              placeholder="e.g. -1 or +2"
              value={countAdjustment}
              onChange={(e) => setCountAdjustment(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Description / Rationale *
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Dean's special scholarship discount"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
            >
              {createLoading ? "Saving..." : "Apply Adjustment"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
