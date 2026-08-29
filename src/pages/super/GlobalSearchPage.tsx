import React, { useState, useEffect } from "react";
import { fetchAllStudents } from "../../services/studentService";
import { fetchPaymentsByStudent } from "../../services/paymentService";
import { useEvent } from "../../hooks/useEvent";
import type { StudentModel, PaymentModel } from "../../types";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import { Search, User, History } from "lucide-react";

export const GlobalSearchPage: React.FC = () => {
  const { classes, events } = useEvent();
  const [allStudents, setAllStudents] = useState<StudentModel[]>([]);
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentModel | null>(null);
  const [studentPayments, setStudentPayments] = useState<PaymentModel[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchAllStudents();
        setAllStudents(list);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const handleSelectStudent = async (student: StudentModel) => {
    setSelectedStudent(student);
    setPaymentsLoading(true);
    try {
      const pays = await fetchPaymentsByStudent(student.id);
      setStudentPayments(pays);
    } catch (err) {
      console.error(err);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const classMap = new Map(classes.map((c) => [c.id, c.displayName]));
  const eventMap = new Map(events.map((e) => [e.id, e.name]));

  const searchResults = query.trim()
    ? allStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.registerNumber.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Global Student Search
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Instantly search any college student by register number or name to audit cross-event payment history.
        </p>

        <div className="relative mt-4">
          <Search className="w-5 h-5 text-emerald-400 absolute left-4 top-3.5 pointer-events-none" />
          <input
            type="text"
            autoFocus
            placeholder="Type student name or register number (e.g. C23CSE01)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-sm font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-xl"
          />
        </div>
      </div>

      {/* Two Column Layout: Search Results & Student Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Results List */}
        <div className="glass-panel p-4 rounded-3xl border border-slate-800 lg:col-span-1 max-h-[70vh] overflow-y-auto space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Matching Students ({searchResults.length})
          </h3>

          {searchResults.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">
              {query ? "No students match your search." : "Type a name or register number above."}
            </p>
          ) : (
            searchResults.map((s) => {
              const isSelected = selectedStudent?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectStudent(s)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/40 text-slate-100"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-mono font-bold text-xs text-emerald-400">
                      {s.registerNumber}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {classMap.get(s.classId) || s.department}
                    </span>
                  </div>
                  <p className="font-semibold text-sm mt-1">{s.name}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Student Profile & Financial Timeline */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 lg:col-span-2">
          {selectedStudent ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3.5 bg-emerald-500/10 rounded-2xl text-emerald-400">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{selectedStudent.name}</h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Reg: <span className="text-slate-200 font-bold">{selectedStudent.registerNumber}</span> • Class: {classMap.get(selectedStudent.classId) || selectedStudent.classId}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">
                  Active Student
                </span>
              </div>

              {/* Payments History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span>Cross-Event Payment History</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {studentPayments.length} transactions
                  </span>
                </div>

                {studentPayments.length === 0 && !paymentsLoading ? (
                  <p className="text-xs text-slate-500 italic py-4">
                    No payment records found for this student across events.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {studentPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-sm text-emerald-400">
                              {formatINR(p.amount)}
                            </span>
                            <span className="text-slate-400 uppercase font-semibold">
                              via {p.paymentMethod}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="font-semibold text-slate-300">
                              {eventMap.get(p.eventId) || "Event"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Logged on {formatDateTime(p.addedAt)}
                            {p.addedByName ? ` by ${p.addedByName}` : ""}
                          </p>
                          {p.paymentReference && (
                            <p className="text-[11px] text-slate-400 font-mono">
                              Ref: {p.paymentReference}
                            </p>
                          )}
                        </div>

                        <StatusBadge status={p.status} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <EmptyState
                icon={Search}
                title="Select a Student"
                description="Search by name or register number and select a student from the list to inspect their complete profile and transaction log."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
