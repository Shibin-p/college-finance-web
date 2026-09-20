import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
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
  Calendar,
  X,
} from "lucide-react";

/**
 * Safely extracts the date string (YYYY-MM-DD) in Asia/Kolkata (IST) timezone.
 */
function getReceiptISTDate(r: CentralReceiptModel): string {
  if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
    return r.date;
  }
  if (r.createdAt) {
    try {
      const millis =
        typeof (r.createdAt as any)?.toMillis === "function"
          ? (r.createdAt as any).toMillis()
          : typeof (r.createdAt as any)?.seconds === "number"
          ? (r.createdAt as any).seconds * 1000
          : new Date(r.createdAt).getTime();
      if (!isNaN(millis)) {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(millis));
      }
    } catch {
      // fallback to r.date
    }
  }
  return r.date || "";
}

/**
 * Formats YYYY-MM-DD into a readable Indian date format: e.g. "15 September 2026"
 */
function formatISTDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (year && month && day) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export const CentralReceiptsPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();
  const { isCrossClassAssistant, crossClassAuthorizedClassIds } = usePermissions();

  const [receipts, setCentralReceipts] = useState<CentralReceiptModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");

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

  // Determine allowed classes for modal dropdown
  const allowedClasses = classes.filter((c) => {
    if (c.active === false) return false;
    if (
      isCrossClassAssistant &&
      userProfile?.role !== "super_coordinator" &&
      crossClassAuthorizedClassIds.length > 0
    ) {
      return crossClassAuthorizedClassIds.includes(c.id);
    }
    return true;
  });

  useEffect(() => {
    if (allowedClasses.length > 0 && !classId) {
      setClassId(allowedClasses[0].id);
    }
  }, [allowedClasses]);

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

  // Filter receipts by selected date with IST date matching
  const filteredReceipts = receipts.filter((r) => {
    if (selectedClassId !== "all" && r.classId !== selectedClassId) {
      return false;
    }
    if (selectedDate) {
      const rDate = getReceiptISTDate(r);
      if (rDate !== selectedDate) return false;
    }
    return true;
  });

  // Calculate totals strictly from the active filtered results
  const grandTotal = filteredReceipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const totalCash = filteredReceipts.reduce((sum, r) => sum + (r.cashAmount || 0), 0);
  const totalDigital = filteredReceipts.reduce((sum, r) => sum + (r.digitalAmount || 0), 0);

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

      {/* Summary Stats Cards */}
      {selectedDate ? (
        /* Daily Total Summary when a specific date is selected */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Daily Summary for {formatISTDisplayDate(selectedDate)}
                {selectedClassId !== "all" ? ` • ${classMap.get(selectedClassId) || selectedClassId}` : ""}
              </span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {filteredReceipts.length} handover{filteredReceipts.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Total Received
              </p>
              <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
                {formatINR(grandTotal)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Total received on {formatISTDisplayDate(selectedDate)}</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-blue-500/30 bg-blue-950/10">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                UPI
              </p>
              <p className="text-2xl font-extrabold font-mono text-blue-400 mt-1">
                {formatINR(totalDigital)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Online & UPI transfers</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/10">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Cash
              </p>
              <p className="text-2xl font-extrabold font-mono text-amber-400 mt-1">
                {formatINR(totalCash)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Direct physical cash received</p>
            </div>
          </div>
        </div>
      ) : (
        /* Overall Summary Stats */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Handed In
            </p>
            <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
              {formatINR(grandTotal)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{filteredReceipts.length} handover deposits</p>
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
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Class:
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.displayName} ({cls.department})
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer [color-scheme:dark]"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                title="Clear date filter"
              >
                <X className="w-3.5 h-3.5" />
                <span>All Dates</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Indication & Reset Button */}
        {(selectedClassId !== "all" || selectedDate) && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Filtered ({filteredReceipts.length} entries)</span>
            <button
              type="button"
              onClick={() => {
                setSelectedClassId("all");
                setSelectedDate("");
              }}
              className="text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Receipts Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Handover Register Entries ({filteredReceipts.length})
          </h3>
        </div>

        {filteredReceipts.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={Receipt}
              title={selectedDate || selectedClassId !== "all" ? "No Matching Receipts" : "No Central Receipts"}
              description={
                selectedDate || selectedClassId !== "all"
                  ? "No fund handovers match the selected filter criteria."
                  : "No fund handovers have been recorded yet for this event."
              }
              actionLabel={selectedDate || selectedClassId !== "all" ? "Reset Filters" : "Record Handover"}
              onAction={
                selectedDate || selectedClassId !== "all"
                  ? () => {
                      setSelectedClassId("all");
                      setSelectedDate("");
                    }
                  : () => setCreateModalOpen(true)
              }
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
                {filteredReceipts.map((r) => (
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
              {allowedClasses.map((cls) => (
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
