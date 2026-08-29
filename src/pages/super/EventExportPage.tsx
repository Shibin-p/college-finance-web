import React, { useState } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { fetchEventParticipants, fetchAllStudents } from "../../services/studentService";
import { fetchPayments } from "../../services/paymentService";
import { fetchExpenses } from "../../services/expenseService";
import { fetchAdjustments } from "../../services/adjustmentService";
import { fetchCentralReceipts } from "../../services/receiptService";
import { fetchDailyClosings } from "../../services/closingService";
import { fetchAuditLogs } from "../../services/auditService";
import { exportEventDataJSON } from "../../services/exportService";
import { DownloadCloud, CheckCircle2, FileJson } from "lucide-react";

export const EventExportPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportedTime, setExportedTime] = useState<string | null>(null);

  const handleExport = async () => {
    if (!activeEvent || !userProfile) return;
    setExporting(true);
    try {
      const [
        students,
        participants,
        payments,
        expenses,
        adjustments,
        receipts,
        closings,
        auditLogs,
      ] = await Promise.all([
        fetchAllStudents(),
        fetchEventParticipants(activeEvent.id),
        fetchPayments(activeEvent.id),
        fetchExpenses(activeEvent.id),
        fetchAdjustments(activeEvent.id),
        fetchCentralReceipts(activeEvent.id),
        fetchDailyClosings(activeEvent.id),
        fetchAuditLogs({ eventId: activeEvent.id }),
      ]);

      const backupPayload = {
        metadata: {
          system: "EKCTC Finance",
          exportedBy: userProfile.name,
          exportedByEmail: userProfile.email,
          exportedAt: new Date().toISOString(),
          version: "1.0",
        },
        event: activeEvent,
        classes,
        students,
        eventParticipants: participants,
        payments,
        expenses,
        adjustments,
        centralReceipts: receipts,
        dailyClosings: closings,
        auditLogs,
      };

      await exportEventDataJSON(activeEvent.name, backupPayload, userProfile);
      setExportedTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Event Data Backup Export
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Export a complete, self-contained JSON data package of the active event's records for archival.
          </p>
        </div>
      </div>

      {/* Export Action Card */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center max-w-xl mx-auto space-y-4">
        <div className="p-4 bg-emerald-500/10 rounded-3xl text-emerald-400 inline-flex">
          <DownloadCloud className="w-10 h-10" />
        </div>

        <h2 className="text-lg font-bold text-slate-100">
          Export Data Package for "{activeEvent?.name}"
        </h2>

        <p className="text-xs text-slate-400 leading-relaxed">
          This export includes all student rosters, participant exemptions, waivers, installment records, approved payments, central receipt handovers, expenditures, adjustments, daily closings, and immutable audit trails for this event.
        </p>

        <div className="pt-4">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !activeEvent}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Compiling Event Data...</span>
              </>
            ) : (
              <>
                <FileJson className="w-4 h-4" />
                <span>Download Event JSON Archive</span>
              </>
            )}
          </button>
        </div>

        {exportedTime && (
          <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Archive exported successfully at {exportedTime}</span>
          </div>
        )}
      </div>
    </div>
  );
};
