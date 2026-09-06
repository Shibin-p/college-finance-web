import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchEffectiveEventParticipants, fetchAllStudents } from "../../services/studentService";
import { fetchPayments } from "../../services/paymentService";
import {
  calculateClassWiseViewerStats,
  resolvePublicStudentStatus,
} from "../../utils/calculations";
import type { EventParticipantModel, PaymentModel, StudentModel } from "../../types";
import { formatINR } from "../../utils/formatters";
import { EmptyState } from "../../components/common/EmptyState";
import { StatusBadge } from "../../components/common/StatusBadge";
import {
  GraduationCap,
  Users,
  Search,
  Lock,
  Calendar,
  Layers,
} from "lucide-react";

export const ViewerClassStats: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { viewerScope, viewerPermissions } = usePermissions();

  const [participants, setParticipants] = useState<EventParticipantModel[]>([]);
  const [payments, setPayments] = useState<PaymentModel[]>([]);
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [loading, setLoading] = useState(false);

  // Viewing Mode: "overall" | "student_status"
  const [viewMode, setViewMode] = useState<"overall" | "student_status">("overall");

  // Mode B Filters
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const activeClasses = classes.filter((c) => c.active !== false);
  const activeClassIds = new Set(activeClasses.map((c) => c.id));

  useEffect(() => {
    if (!activeEvent) return;
    const load = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [
          fetchEffectiveEventParticipants(activeEvent, activeClasses),
          fetchPayments(activeEvent.id),
        ];

        if (viewerPermissions.canViewStudentCollectionStatus) {
          promises.push(fetchAllStudents());
        }

        const [parts, pays, studs] = await Promise.all(promises);
        const eligiblePayments = (pays || []).filter(
          (p: PaymentModel) => !p.classId || activeClassIds.has(p.classId)
        );
        const eligibleStuds = (studs || []).filter(
          (s: StudentModel) => !s.classId || activeClassIds.has(s.classId)
        );

        setParticipants(parts || []);
        setPayments(eligiblePayments);
        if (viewerPermissions.canViewStudentCollectionStatus && studs) {
          setStudents(eligibleStuds);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeEvent?.id, classes, viewerPermissions.canViewStudentCollectionStatus]);

  // Mode A: Class Overall Metrics
  const classSummaries = activeClasses.map((cls) =>
    calculateClassWiseViewerStats(cls, participants, payments)
  );

  // Mode B: Student Payment Status List
  const classFilteredStudents = students.filter((s) => {
    if (selectedClassId === "all") return true;
    return s.classId === selectedClassId;
  });

  const studentStatusList = classFilteredStudents
    .filter((s) => {
      if (!searchTerm) return true;
      return (
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.registerNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .map((s) => {
      const part = participants.find((p) => p.studentId === s.id);
      const studentPays = payments.filter((p) => p.studentId === s.id);
      const publicStatus = resolvePublicStudentStatus(part, studentPays);
      const cls = classes.find((c) => c.id === s.classId);

      return {
        student: s,
        className: cls?.displayName || s.classId,
        department: cls?.department || s.department,
        publicStatus,
      };
    });

  if (!activeEvent && !loading) {
    return (
      <div className="py-12">
        <EmptyState
          icon={Calendar}
          title="No Active Event"
          description="There are currently no active college events to view class statistics."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              Class Analytics
            </span>
            <span className="text-xs text-slate-400">• {activeEvent?.name}</span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              Scope: {viewerScope === "specific_class" ? "Class Scope" : "College Overview"}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Class-Wise Collection & Settlement
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Detailed department breakdown and individual student payment settlement status.
          </p>
        </div>

        {/* Mode Selector Switch */}
        <div className="flex items-center p-1 bg-slate-900 rounded-2xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("overall")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === "overall"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overall Class Status</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("student_status")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === "student_status"
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Student Payment Status</span>
          </button>
        </div>
      </div>

      {/* MODE A: Class Overall Status */}
      {viewMode === "overall" && (
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Class Aggregate Overview ({classSummaries.length} Classes)
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Settled includes fully paid & coordinator-waived students
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Dept / Year</th>
                  <th className="py-3 px-4 text-center">Total Students</th>
                  <th className="py-3 px-4 text-center font-semibold text-emerald-400">Fully Paid</th>
                  <th className="py-3 px-4 text-center text-teal-300">Partially Paid</th>
                  <th className="py-3 px-4 text-center text-amber-400">Pending</th>
                  <th className="py-3 px-4 text-center text-purple-300">Exempted</th>
                  <th className="py-3 px-4 font-mono">Target</th>
                  <th className="py-3 px-4 font-mono">Received</th>
                  <th className="py-3 px-4 text-right">Collection %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {classSummaries.map((cs) => (
                  <tr key={cs.classId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-100">{cs.className}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {cs.department} (Year {cs.year})
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300 font-mono">
                      {cs.totalStudents}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-400 font-bold font-mono">
                      {cs.settledCount}
                    </td>
                    <td className="py-3 px-4 text-center text-teal-300 font-semibold font-mono">
                      {cs.partiallyPaidCount}
                    </td>
                    <td className="py-3 px-4 text-center text-amber-400 font-semibold font-mono">
                      {cs.pendingCount}
                    </td>
                    <td className="py-3 px-4 text-center text-purple-300 font-semibold font-mono">
                      {cs.exemptedCount}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {formatINR(cs.totalTarget)}
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-emerald-400">
                      {formatINR(cs.totalCollected)}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-200">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono">{cs.collectionPercentage}%</span>
                        <div className="w-12 bg-slate-900 h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, cs.collectionPercentage)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE B: Individual Student Payment Status */}
      {viewMode === "student_status" && (
        <div className="space-y-4">
          {!viewerPermissions.canViewStudentCollectionStatus ? (
            <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Student-Level Status Restricted
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Your View Coordinator account is configured for aggregate statistics only. Access to individual student payment status has not been enabled by the Super Coordinator.
              </p>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden space-y-4">
              {/* Filter controls */}
              <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-300 uppercase shrink-0">
                    Filter Class:
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="all">All Classes ({activeClasses.length})</option>
                    {activeClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.displayName} ({cls.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search student or register no..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              {studentStatusList.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={GraduationCap}
                    title="No Student Records Found"
                    description="No students matching the selected class or search filter."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Register Number</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Class / Department</th>
                        <th className="py-3 px-4 text-right">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {studentStatusList.map((item) => {
                        const statusVariant =
                          item.publicStatus === "Paid"
                            ? "fully_paid"
                            : item.publicStatus === "Partially Paid"
                            ? "partially_paid"
                            : item.publicStatus === "Exempted"
                            ? "exempted"
                            : "not_paid";

                        return (
                          <tr
                            key={item.student.id}
                            className="hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-3 px-4 font-mono font-bold text-slate-200">
                              {item.student.registerNumber}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-100">
                              {item.student.name}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {item.className} ({item.department})
                            </td>
                            <td className="py-3 px-4 text-right">
                              <StatusBadge status={statusVariant} size="sm" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
