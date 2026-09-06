import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchCentralReceipts,
  createCentralReceipt,
} from "../../services/receiptService";
import type { CentralReceiptModel } from "../../types";
import { Modal } from "../../components/common/Modal";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR } from "../../utils/formatters";
import {
  Receipt,
  Plus,
} from "lucide-react";

export const CentralReceiptsPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();

  const [receipts, setCentralReceipts] = useState<CentralReceiptModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");

  // Create receipt modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [cashAmount, setCashAmount] = useState<string>("0");
  const [digitalAmount, setDigitalAmount] = useState<string>("0");
  const [otherAmount, setOtherAmount] = useState<string>("0");
  const [totalAmount, setTotalAmount] = useState<string>("0");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadReceipts = async () => {
    if (!activeEvent) return;
    setLoading(true);
    try {
      const list = await fetchCentralReceipts(
        activeEvent.id,
        selectedClassId === "all" ? undefined : selectedClassId
      );
      setCentralReceipts(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [activeEvent?.id, selectedClassId]);

  const activeClasses = classes.filter((c) => c.active !== false);

  useEffect(() => {
    if (activeClasses.length > 0 && !classId) {
      setClassId(activeClasses[0].id);
    }
  }, [activeClasses]);

  const handleSplitChange = (c: string, d: string, o: string) => {
    setCashAmount(c);
    setDigitalAmount(d);
    setOtherAmount(o);
    const sum = (parseFloat(c) || 0) + (parseFloat(d) || 0) + (parseFloat(o) || 0);
    setTotalAmount(String(sum));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !userProfile || !classId) return;
    setCreateError("");

    const numTotal = parseFloat(totalAmount) || 0;
    const numCash = parseFloat(cashAmount) || 0;
    const numDigital = parseFloat(digitalAmount) || 0;
    const numOther = parseFloat(otherAmount) || 0;

    if (numTotal <= 0) {
      setCreateError("Total amount must be greater than 0");
      return;
    }

    if (numCash + numDigital + numOther !== numTotal) {
      setCreateError("Sum of Cash + Digital + Other does not match Total Amount.");
      return;
    }

    setCreateLoading(true);
    try {
      await createCentralReceipt(
        {
          eventId: activeEvent.id,
          classId,
          totalAmount: numTotal,
          cashAmount: numCash,
          digitalAmount: numDigital,
          otherAmount: numOther,
          date,
          remarks,
        },
        userProfile
      );

      await loadReceipts();
      setCreateModalOpen(false);
      setCashAmount("0");
      setDigitalAmount("0");
      setOtherAmount("0");
      setTotalAmount("0");
      setRemarks("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to record central receipt");
    } finally {
      setCreateLoading(false);
    }
  };

  const classMap = new Map(classes.map((c) => [c.id, c.displayName]));

  const grandTotal = receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const totalCash = receipts.reduce((sum, r) => sum + (r.cashAmount || 0), 0);
  const totalDigital = receipts.reduce((sum, r) => sum + (r.digitalAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Central Receipts Register
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Official handover log where class coordinators deposit physical cash & UPI collections into central custody.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Central Handover</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Handed In
          </p>
          <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
            {formatINR(grandTotal)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{receipts.length} handover deposits</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Physical Cash
          </p>
          <p className="text-2xl font-extrabold font-mono text-amber-400 mt-1">
            {formatINR(totalCash)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Direct cash in treasury</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Digital / UPI
          </p>
          <p className="text-2xl font-extrabold font-mono text-blue-400 mt-1">
            {formatINR(totalDigital)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Verified UPI / account transfers</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 glass-panel p-4 rounded-2xl border border-slate-800">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Filter by Class:
        </label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">All Classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.displayName} ({cls.department})
            </option>
          ))}
        </select>
      </div>

      {/* Receipts Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Handover Register Entries ({receipts.length})
          </h3>
        </div>

        {receipts.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={Receipt}
              title="No Central Receipts"
              description="No fund handovers have been recorded yet for this event."
              actionLabel="Record Handover"
              onAction={() => setCreateModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 font-mono">Total Amount</th>
                  <th className="py-3 px-4 font-mono">Cash</th>
                  <th className="py-3 px-4 font-mono">Digital</th>
                  <th className="py-3 px-4 font-mono">Other</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {r.date} {r.time && `• ${r.time}`}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100">
                      {classMap.get(r.classId) || r.classId}
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-sm text-emerald-400">
                      {formatINR(r.totalAmount)}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-400">{formatINR(r.cashAmount)}</td>
                    <td className="py-3 px-4 font-mono text-blue-400">{formatINR(r.digitalAmount)}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{formatINR(r.otherAmount)}</td>
                    <td className="py-3 px-4 text-slate-300">{r.receivedByName || "Super Admin"}</td>
                    <td className="py-3 px-4 text-slate-400">{r.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Handover Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Record Central Receipt Handover"
        subtitle="Mandatory split verification: Cash + Digital + Other must equal Total Amount"
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
              Academic Class *
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {activeClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.displayName} ({cls.department})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                Cash (₹)
              </label>
              <input
                type="number"
                min="0"
                value={cashAmount}
                onChange={(e) => handleSplitChange(e.target.value, digitalAmount, otherAmount)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                Digital / UPI (₹)
              </label>
              <input
                type="number"
                min="0"
                value={digitalAmount}
                onChange={(e) => handleSplitChange(cashAmount, e.target.value, otherAmount)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-blue-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                Other (₹)
              </label>
              <input
                type="number"
                min="0"
                value={otherAmount}
                onChange={(e) => handleSplitChange(cashAmount, digitalAmount, e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300 uppercase">Calculated Total:</span>
            <span className="font-mono font-extrabold text-base text-emerald-400">
              {formatINR(parseFloat(totalAmount) || 0)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Handover Date *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Day 1 evening batch handover"
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
              {createLoading ? "Saving..." : "Record Handover"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
