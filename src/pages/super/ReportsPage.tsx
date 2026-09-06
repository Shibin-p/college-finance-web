import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { fetchEffectiveEventParticipants } from "../../services/studentService";
import { fetchPayments } from "../../services/paymentService";
import {
  calculateAggregateTotals,
  calculateYearWiseStats,
} from "../../utils/calculations";
import {
  exportClassReportExcel,
  exportClassReportPDF,
  exportYearWiseExcel,
  exportYearWisePDF,
  type ClassReportRow,
} from "../../services/exportService";
import type {
  EventParticipantModel,
  PaymentModel,
  ReportMode,
  YearWiseStatsModel,
} from "../../types";
import { formatINR } from "../../utils/formatters";
import {
  FileSpreadsheet,
  FileText,
  Layers,
  GraduationCap,
} from "lucide-react";

export const ReportsPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile } = useAuth();

  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [reportMode, setReportMode] = useState<ReportMode>("class_wise");
  const [exporting, setExporting] = useState(false);

  const activeClasses = classes.filter((c) => c.active !== false);
  const activeClassIds = new Set(activeClasses.map((c) => c.id));

  useEffect(() => {
    if (!activeEvent) return;
    const load = async () => {
      try {
        const [parts, pays] = await Promise.all([
          fetchEffectiveEventParticipants(activeEvent, activeClasses),
          fetchPayments(activeEvent.id),
        ]);
        const eligiblePayments = (pays || []).filter(
          (p: PaymentModel) => !p.classId || activeClassIds.has(p.classId)
        );
        setParticipants(parts || []);
        setPayments(eligiblePayments);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [activeEvent?.id, classes]);

  // Generate Class-wise report data for active classes only
  const classReportRows: ClassReportRow[] = activeClasses.map((cls) => {
    const classParticipants = participants.filter((p) => p.classId === cls.id);
    const classPayments = payments.filter((p) => p.classId === cls.id);
    const agg = calculateAggregateTotals(classParticipants, classPayments);

    return {
      class: cls.displayName,
      department: String(cls.department),
      year: cls.year,
      totalStudents: agg.totalStudents,
      fullyPaid: agg.fullyPaidCount,
      partiallyPaid: agg.partiallyPaidCount,
      pending: agg.pendingCount,
      exempted: agg.exemptedStudents,
      totalRequired: agg.totalRequired,
      totalReceived: agg.totalApprovedReceived,
      totalOutstanding: agg.totalOutstanding,
      collectionPercentage: `${agg.collectionPercentage}%`,
    };
  });

  // Generate Year-wise report data (1st to 4th Year) strictly for active classes
  const yearStatsRows: YearWiseStatsModel[] = [1, 2, 3, 4].map((yr) =>
    calculateYearWiseStats(yr, participants, payments, activeClasses)
  );

  const handleExportExcel = async () => {
    if (!activeEvent || !userProfile) return;
    setExporting(true);
    try {
      if (reportMode === "class_wise") {
        await exportClassReportExcel(activeEvent.name, classReportRows, userProfile);
      } else {
        await exportYearWiseExcel(activeEvent.name, yearStatsRows, userProfile);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!activeEvent || !userProfile) return;
    setExporting(true);
    try {
      if (reportMode === "class_wise") {
        await exportClassReportPDF(activeEvent.name, classReportRows, userProfile);
      } else {
        await exportYearWisePDF(activeEvent.name, yearStatsRows, userProfile);
      }
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
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Administrative Statements
            </span>
            <span className="text-xs text-slate-400">• {activeEvent?.name}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Financial Reports & Document Exports
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Generate and export official Class-wise and Year-wise college finance statements in Excel (.xlsx) and PDF format.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Export PDF Document</span>
          </button>
        </div>
      </div>

      {/* Report Mode Switcher Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setReportMode("class_wise")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              reportMode === "class_wise"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Class-Wise Report</span>
          </button>

          <button
            type="button"
            onClick={() => setReportMode("year_wise")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              reportMode === "year_wise"
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Year-Wise Report</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-mono hidden sm:block">
          Mode: {reportMode === "class_wise" ? "Class Roster Statements" : "Academic Batch Analytics"}
        </span>
      </div>

      {/* Report Preview Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              {reportMode === "class_wise" ? "Class-Wise Statement Preview" : "Year-Wise Statement Preview"} ({activeEvent?.name})
            </h3>
            <p className="text-xs text-slate-400">
              Live calculated data matching exported Excel and PDF document tables
            </p>
          </div>
        </div>

        {reportMode === "class_wise" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 text-center">Total Students</th>
                  <th className="py-3 px-4 text-center font-bold text-emerald-400">Fully Paid</th>
                  <th className="py-3 px-4 text-center text-teal-300">Partially Paid</th>
                  <th className="py-3 px-4 text-center text-amber-400">Pending</th>
                  <th className="py-3 px-4 text-center text-purple-300">Exempted</th>
                  <th className="py-3 px-4 font-mono">Required</th>
                  <th className="py-3 px-4 font-mono">Received</th>
                  <th className="py-3 px-4 font-mono">Outstanding</th>
                  <th className="py-3 px-4 text-right">Collection %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {classReportRows.map((r) => (
                  <tr key={r.class} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-100">{r.class}</td>
                    <td className="py-3 px-4 text-center text-slate-300 font-mono">{r.totalStudents}</td>
                    <td className="py-3 px-4 text-center text-emerald-400 font-bold font-mono">{r.fullyPaid}</td>
                    <td className="py-3 px-4 text-center text-teal-300 font-semibold font-mono">{r.partiallyPaid}</td>
                    <td className="py-3 px-4 text-center text-amber-400 font-semibold font-mono">{r.pending}</td>
                    <td className="py-3 px-4 text-center text-purple-300 font-semibold font-mono">{r.exempted}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{formatINR(r.totalRequired)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{formatINR(r.totalReceived)}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{formatINR(r.totalOutstanding)}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-200">
                      {r.collectionPercentage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Academic Batch</th>
                  <th className="py-3 px-4 text-center">Total Students</th>
                  <th className="py-3 px-4 text-center font-bold text-emerald-400">Fully Paid / Settled</th>
                  <th className="py-3 px-4 text-center text-teal-300">Partially Paid</th>
                  <th className="py-3 px-4 text-center text-amber-400">Pending</th>
                  <th className="py-3 px-4 text-center text-purple-300">Exempted</th>
                  <th className="py-3 px-4 font-mono">Target (INR)</th>
                  <th className="py-3 px-4 font-mono">Collected (INR)</th>
                  <th className="py-3 px-4 font-mono">Remaining (INR)</th>
                  <th className="py-3 px-4 text-right">Collection %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {yearStatsRows.map((ys) => (
                  <tr key={ys.year} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-emerald-400" />
                      <span>{ys.yearLabel}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300 font-mono">{ys.totalStudents}</td>
                    <td className="py-3 px-4 text-center text-emerald-400 font-bold font-mono">{ys.settledCount}</td>
                    <td className="py-3 px-4 text-center text-teal-300 font-semibold font-mono">{ys.partiallyPaidCount}</td>
                    <td className="py-3 px-4 text-center text-amber-400 font-semibold font-mono">{ys.pendingCount}</td>
                    <td className="py-3 px-4 text-center text-purple-300 font-semibold font-mono">{ys.exemptedCount}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{formatINR(ys.totalTarget)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{formatINR(ys.totalCollected)}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{formatINR(ys.remainingBalance)}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-200">
                      {ys.collectionPercentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
