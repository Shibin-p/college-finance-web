import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useEvent } from "../../hooks/useEvent";
import { usePermissions } from "../../hooks/usePermissions";
import {
  LogOut,
  ChevronDown,
  Layers,
  LayoutDashboard,
  Eye,
  Shield,
  Mail,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export const Header: React.FC = () => {
  const { userProfile, currentUser, logout } = useAuth();
  const { events, activeEvent, setActiveEvent } = useEvent();
  const { isCrossClassAssistant, isViewCoordinator, isClassCoordinator } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const isAssistantRoute = location.pathname.startsWith("/collection-assistant");
  const isViewerRoute = location.pathname.startsWith("/viewer");
  const isCoordinatorRoute = location.pathname.startsWith("/coordinator");

  const hasMultipleWorkspaces =
    (isViewCoordinator && isCrossClassAssistant) ||
    (isClassCoordinator && isCrossClassAssistant);

  const roleLabel =
    userProfile?.role === "super_coordinator"
      ? "Super Coordinator"
      : userProfile?.role === "class_coordinator"
      ? "Class Coordinator"
      : "View Coordinator";

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const userInitial = userProfile?.name
    ? userProfile.name.trim().charAt(0).toUpperCase()
    : "U";

  return (
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3 flex items-center justify-between">
      {/* Left: Brand Logo & Event Selector Workspace Switcher */}
      <div className="flex items-center gap-3 sm:gap-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img
            src="/favicon.svg"
            alt="EKCTC Finance"
            className="w-8 h-8 rounded-xl shrink-0 group-hover:scale-105 transition-transform"
          />
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
              className="appearance-none bg-slate-900/90 text-xs font-bold text-slate-100 pl-3 pr-8 py-2 rounded-xl border border-slate-700/80 hover:border-slate-600 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-inner max-w-[150px] sm:max-w-xs truncate"
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

        {/* Workspace Switcher for Users with Dual Access */}
        {hasMultipleWorkspaces && (
          <div className="hidden md:flex items-center p-1 bg-slate-900/90 rounded-2xl border border-slate-800 gap-1">
            {isViewCoordinator && (
              <button
                type="button"
                onClick={() => navigate("/viewer/dashboard")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isViewerRoute
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Coordinator</span>
              </button>
            )}

            {isClassCoordinator && (
              <button
                type="button"
                onClick={() => navigate("/coordinator/dashboard")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isCoordinatorRoute
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Class Coordinator</span>
              </button>
            )}

            {isCrossClassAssistant && (
              <button
                type="button"
                onClick={() => navigate("/collection-assistant/dashboard")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isAssistantRoute
                    ? "bg-teal-500/25 text-teal-300 border border-teal-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                <span>Collection Assistant</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: User Profile & Account Dropdown */}
      <div className="relative flex items-center gap-3" ref={accountMenuRef}>
        {/* Desktop Profile Info */}
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-slate-100">{userProfile?.name || "System User"}</p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              {roleLabel}
            </span>
            {isCrossClassAssistant && userProfile?.role !== "super_coordinator" && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30">
                + Assistant
              </span>
            )}
          </div>
        </div>

        {/* Account Trigger Button (Mobile & Desktop) */}
        <button
          type="button"
          onClick={() => setAccountMenuOpen(!accountMenuOpen)}
          title="Account details and settings"
          className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 transition-all cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {userInitial}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${accountMenuOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Popover / Dropdown Menu */}
        {accountMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {userInitial}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-100 truncate">
                    {userProfile?.name || "Coordinator"}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-[10px] font-semibold text-emerald-300 truncate">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              {isCrossClassAssistant && userProfile?.role !== "super_coordinator" && (
                <div className="mt-2 px-2 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[10px] font-semibold text-teal-300 flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-teal-400 shrink-0" />
                  <span>+ Cross-Class Collection Assistant</span>
                </div>
              )}

              {(userProfile?.email || currentUser?.email) && (
                <div className="pt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{userProfile?.email || currentUser?.email}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen(false);
                  logout();
                }}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
