import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { useEvent } from "../../hooks/useEvent";
import {
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Link } from "react-router-dom";

export const Header: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const { events, activeEvent, setActiveEvent } = useEvent();

  const roleLabel =
    userProfile?.role === "super_coordinator"
      ? "Super Coordinator"
      : userProfile?.role === "class_coordinator"
      ? "Class Coordinator"
      : "View Coordinator";

  return (
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3 flex items-center justify-between">
      {/* Left: Brand Logo & Event Selector Workspace Switcher */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src="/favicon.svg" alt="EKCTC Finance" className="w-8 h-8 rounded-xl shrink-0 group-hover:scale-105 transition-transform" />
          <div className="hidden sm:block">
            <span className="text-sm font-extrabold text-white tracking-tight block leading-tight">
              EKCTC Finance
            </span>
            <span className="text-[10px] text-slate-500 font-medium block leading-none">
              College System
            </span>
          </div>
        </Link>

        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        <div className="relative flex items-center">
          <div className="relative">
            <select
              value={activeEvent?.id || ""}
              onChange={(e) => {
                const found = events.find((ev) => ev.id === e.target.value);
                if (found) setActiveEvent(found);
              }}
              className="appearance-none bg-slate-900/90 text-xs font-bold text-slate-100 pl-3 pr-8 py-2 rounded-xl border border-slate-700/80 hover:border-slate-600 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-inner max-w-[180px] sm:max-w-xs truncate"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-slate-900 text-slate-200">
                  {ev.name} ({ev.status.toUpperCase()})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Right: User Profile & Quick Actions */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-slate-100">{userProfile?.name || "System User"}</p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              {roleLabel}
            </span>
          </div>
        </div>

        <button
          onClick={() => logout()}
          title="Sign Out"
          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-950/20 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
