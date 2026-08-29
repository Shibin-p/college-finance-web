import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { fetchPayments } from "../../services/paymentService";
import { fetchCentralReceipts } from "../../services/receiptService";
import {
  calculateReconciliation,
  type ReconciliationReport,
} from "../../utils/calculations";
import type { PaymentModel, CentralReceiptModel } from "../../types";
import { StatusBadge } from "../../components/common/StatusBadge";
import { formatINR } from "../../utils/formatters";

export const ReconciliationPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();

  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [centralReceipts, setCentralReceipts] = useState<CentralReceiptModel[]>([]);

  const loadData = async () => {
    if (!activeEvent) return;
    try {
      const [pays, rcpts] = await Promise.all([
        fetchPayments(activeEvent.id),
        fetchCentralReceipts(activeEvent.id),
      ]);
      setPayments(pays);
      setCentralReceipts(rcpts);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeEvent?.id]);

  const globalRecon = calculateReconciliation(payments, centralReceipts);

  const classReports: ReconciliationReport[] = classes.map((cls) => {
    const report = calculateReconciliation(payments, centralReceipts, cls.id);
    return {
      ...report,
      className: cls.displayName,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Audit Engine
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Traceable Reconciliation Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compare Student Ledger collections directly against verified Central Receipts to identify physical cash or digital deposit discrepancies.
          </p>
        </div>

        <StatusBadge status={globalRecon.status} size="md" />
      </div>

      {/* Global Comparison Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Approved Student Ledger Total
          </p>
          <p className="text-2xl font-extrabold font-mono text-slate-100 mt-1">
            {formatINR(globalRecon.studentLedgerApprovedTotal)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Total of all approved coordinator receipts
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Central Receipts Handed In
          </p>
          <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
            {formatINR(globalRecon.centralReceiptTotal)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Physical Cash ({formatINR(globalRecon.cashReceived)}) + Digital ({formatINR(globalRecon.digitalReceived)})
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Reconciliation Variance
          </p>
          <p
            className={`text-2xl font-extrabold font-mono mt-1 ${
              globalRecon.isReconciled
                ? "text-emerald-400"
                : globalRecon.discrepancy < 0
                ? "text-rose-400"
                : "text-amber-400"
            }`}
          >
            {globalRecon.discrepancy > 0 ? "+" : ""}
            {formatINR(globalRecon.discrepancy)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {globalRecon.isReconciled
              ? "Ledger perfectly matched"
              : globalRecon.discrepancy < 0
              ? "Under-received: Handover pending from coordinators"
              : "Over-received: Surplus in central treasury"}
          </p>
        </div>
      </div>

      {/* Class-by-Class Reconciliation Audit Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Class-wise Reconciliation Breakdown
            </h3>
            <p className="text-xs text-slate-400">
              Audit each class coordinator's student collection against their physical handovers
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {classReports.length} Classes Audited
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4 font-mono">Approved Student Ledger</th>
                <th className="py-3 px-4 font-mono">Central Receipts</th>
                <th className="py-3 px-4 font-mono">Cash</th>
                <th className="py-3 px-4 font-mono">Digital</th>
                <th className="py-3 px-4 font-mono">Variance (Discrepancy)</th>
                <th className="py-3 px-4 text-right">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {classReports.map((cr) => (
                <tr key={cr.classId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-100">{cr.className}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                    {formatINR(cr.studentLedgerApprovedTotal)}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                    {formatINR(cr.centralReceiptTotal)}
                  </td>
                  <td className="py-3 px-4 font-mono text-amber-400">{formatINR(cr.cashReceived)}</td>
                  <td className="py-3 px-4 font-mono text-blue-400">{formatINR(cr.digitalReceived)}</td>
                  <td className="py-3 px-4 font-mono font-bold">
                    <span
                      className={
                        cr.isReconciled
                          ? "text-emerald-400"
                          : cr.discrepancy < 0
                          ? "text-rose-400"
                          : "text-amber-400"
                      }
                    >
                      {cr.discrepancy > 0 ? "+" : ""}
                      {formatINR(cr.discrepancy)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusBadge status={cr.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
