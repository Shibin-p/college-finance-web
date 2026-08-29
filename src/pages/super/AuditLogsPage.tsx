import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { subscribeToAuditLogs } from "../../services/auditService";
import type { AuditCategory, AuditLogModel } from "../../types";
import { EmptyState } from "../../components/common/EmptyState";
import { formatDateTime } from "../../utils/formatters";
import {
  History,
  Search,
  Shield,
  Clock,
  Calendar,
  Filter,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export const AuditLogsPage: React.FC = () => {
  const { activeEvent, events } = useEvent();

  // Selected event scope: event ID, "all", or "global"
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>("");
  const [logs, setLogs] = useState<AuditLogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Initialize event filter when activeEvent becomes available
  useEffect(() => {
    if (activeEvent?.id && !selectedEventFilter) {
      setSelectedEventFilter(activeEvent.id);
    }
  }, [activeEvent?.id]);

  // Real-time subscription to audit logs
  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);

    const unsubscribe = subscribeToAuditLogs(
      {
        eventId: selectedEventFilter || activeEvent?.id || "all",
        category: (selectedCategory !== "all" ? selectedCategory : undefined) as AuditCategory,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchTerm: searchTerm || undefined,
        limitCount: 300,
      },
      (data) => {
        setLogs(data);
        setLoading(false);
      },
      (err) => {
        console.error("Audit log subscription error:", err);
        setErrorMessage("Failed to load audit logs. Please try again.");
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedEventFilter, activeEvent?.id, selectedCategory, startDate, endDate, searchTerm]);

  const categories: Array<{ id: string; label: string }> = [
    { id: "all", label: "All Activities" },
    { id: "fund_collection", label: "Payments & Installments" },
    { id: "fund_approval", label: "Approvals & Declines" },
    { id: "payment_rollback", label: "Payment Rollbacks" },
    { id: "central_receipt", label: "Central Receipts" },
    { id: "expense", label: "Expenditures" },
    { id: "expense_category", label: "Expense Categories" },
    { id: "daily_closing", label: "Daily Closings" },
    { id: "finance_adjustment", label: "Adjustments" },
    { id: "exemption", label: "Exemptions & Waivers" },
    { id: "student_management", label: "Students & Imports" },
    { id: "permission_change", label: "Permission Changes" },
    { id: "event_management", label: "Events & Classes" },
    { id: "login", label: "Logins & Sessions" },
    { id: "report_export", label: "Report Exports" },
  ];

  const activeEventName =
    selectedEventFilter === "all"
      ? "All College Events"
      : selectedEventFilter === "global"
      ? "Global System Logs"
      : events.find((e) => e.id === selectedEventFilter)?.name || activeEvent?.name || "Selected Event";

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>Immutable Ledger</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              • Viewing: <strong className="text-emerald-400">{activeEventName}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Event-Wise Audit Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Trace every authentication, financial collection, approval, rollback, category edit, and permission change.
          </p>
        </div>

        {/* Event Scope Switcher */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={selectedEventFilter || activeEvent?.id || "all"}
            onChange={(e) => setSelectedEventFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                Event: {ev.name}
              </option>
            ))}
            <option value="all">-- All Events (Global Overview) --</option>
            <option value="global">-- System & Login Logs Only --</option>
          </select>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
        {/* Category Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search and Date Range */}
        <div className="flex flex-col md:flex-row items-center gap-3 pt-2 border-t border-slate-800/80">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by action, description, user, student, or class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {(startDate || endDate || searchTerm || selectedCategory !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSearchTerm("");
                  setSelectedCategory("all");
                }}
                className="p-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
                title="Reset Filters"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Timeline List */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Activity Stream ({logs.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">Real-Time Sync Active</span>
        </div>

        {errorMessage ? (
          <div className="p-8 text-center space-y-3">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-rose-300">{errorMessage}</h4>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Loading audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={History}
              title="No Audit Logs Found"
              description={`No activity recorded matching "${activeEventName}" and your selected filters.`}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-slate-800/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                      {log.category.replace(/_/g, " ")}
                    </span>
                    <span className="font-bold text-slate-100">{log.action.replace(/_/g, " ")}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-300 font-medium">{log.userName || "System User"}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({log.userRole})</span>
                    {log.className && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900 text-slate-400 border border-slate-800">
                        {log.className}
                      </span>
                    )}
                    {log.eventName && (
                      <span className="text-[10px] text-emerald-400 font-medium">
                        [{log.eventName}]
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 text-xs">{log.description}</p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <p className="text-slate-400 font-mono text-[11px] flex items-center gap-1 sm:justify-end">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatDateTime(log.timestamp)}</span>
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                    Log UID: {log.id?.slice(0, 10)}...
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
