import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchEffectiveEventParticipants } from "../../services/studentService";
import { fetchPayments } from "../../services/paymentService";
import { calculateYearWiseStats } from "../../utils/calculations";
import type { EventParticipantModel, PaymentModel } from "../../types";
import { formatINR } from "../../utils/formatters";
import { EmptyState } from "../../components/common/EmptyState";
import {
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ShieldCheck,
} from "lucide-react";

export const ViewerYearStats: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { viewerScope } = usePermissions();
  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [loading, setLoading] = useState(false);

  const activeClasses = classes.filter((c) => c.active !== false);
  const activeClassIds = new Set(activeClasses.map((c) => c.id));

  useEffect(() => {
    if (!activeEvent) return;
    const load = async () => {
      setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeEvent?.id, classes]);

  const years = [1, 2, 3, 4];
  const yearStatsList = years.map((yr) =>
    calculateYearWiseStats(yr, participants, payments, activeClasses)
  );

  if (!activeEvent && !loading) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Calendar}
          title="No Active Event"
          description="There are currently no active college events to view year statistics."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            Executive Analytics
          </span>
          <span className="text-xs text-slate-400">• {activeEvent?.name}</span>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Scope: {viewerScope === "specific_class" ? "Class Scope" : "College Overview"}
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Year-Wise Student Status & Collection Analytics
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Standardized batch-level breakdown across all 4 academic years with student settlement and collection metrics.
        </p>
      </div>

      {/* Year Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {yearStatsList.map((ys) => {
          const yearClasses = classes.filter((c) => c.year === ys.year);
          return (
            <div
              key={ys.year}
              className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 flex flex-col justify-between"
            >
              <div>
                {/* Year Title & % */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">
                        {ys.yearLabel} Batch
                      </h3>
                      <p className="text-xs text-slate-400">
                        {yearClasses.length} academic classes • {ys.totalStudents} total students
                      </p>
                    </div>
                  </div>

                  <span className="text-sm font-extrabold font-mono text-emerald-400 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    {ys.collectionPercentage}%
                  </span>
                </div>

                {/* Student Count Metrics Grid */}
                <div className="mt-4 space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Student Settlement Distribution
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400 font-semibold mb-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Fully Paid</span>
                      </div>
                      <p className="text-base font-extrabold font-mono text-emerald-400">
                        {ys.settledCount}
                      </p>
                      <span className="text-[9px] text-slate-500">Settled</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-teal-400 font-semibold mb-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Partially Paid</span>
                      </div>
                      <p className="text-base font-extrabold font-mono text-teal-300">
                        {ys.partiallyPaidCount}
                      </p>
                      <span className="text-[9px] text-slate-500">Installments</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-amber-400 font-semibold mb-0.5">
                        <Coins className="w-3 h-3" />
                        <span>Pending</span>
                      </div>
                      <p className="text-base font-extrabold font-mono text-amber-400">
                        {ys.pendingCount}
                      </p>
                      <span className="text-[9px] text-slate-500">Due</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-purple-400 font-semibold mb-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Exempted</span>
                      </div>
                      <p className="text-base font-extrabold font-mono text-purple-300">
                        {ys.exemptedCount}
                      </p>
                      <span className="text-[9px] text-slate-500">Exempt</span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Year Target:</span>
                    <span className="font-mono font-bold text-slate-200">
                      {formatINR(ys.totalTarget)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Collected:</span>
                    <span className="font-mono font-extrabold text-emerald-400">
                      {formatINR(ys.totalCollected)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Remaining Balance:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatINR(ys.remainingBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>Batch Collection Progress</span>
                  <span className="font-mono text-emerald-400">{ys.collectionPercentage}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ys.collectionPercentage)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
