import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import {
  LayoutDashboard,
  Calendar,
  GraduationCap,
  Users,
  Coins,
  CheckSquare,
  Receipt,
  Scale,
  CreditCard,
  FileSpreadsheet,
  History,
  UserCheck,
  Search,
  Sliders,
  Clock,
  DownloadCloud,
  Layers,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const { userProfile } = useAuth();
  const { isCrossClassAssistant, isClassCoordinator } = usePermissions();
  if (!userProfile) return null;

  const superLinks = [
    { to: "/super/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/super/events", icon: Calendar, label: "Events" },
    { to: "/super/classes", icon: GraduationCap, label: "Classes" },
    { to: "/super/students", icon: Users, label: "Students" },
    { to: "/super/collection", icon: Coins, label: "Collection Ledger" },
    { to: "/super/approvals", icon: CheckSquare, label: "Approvals" },
    { to: "/super/receipts", icon: Receipt, label: "Central Receipts" },
    { to: "/super/reconciliation", icon: Scale, label: "Reconciliation" },
    { to: "/super/expenses", icon: CreditCard, label: "Expenses" },
    { to: "/super/closing", icon: Clock, label: "Daily Closing" },
    { to: "/super/adjustments", icon: Sliders, label: "Adjustments" },
    { to: "/super/reports", icon: FileSpreadsheet, label: "Reports" },
    { to: "/super/audit", icon: History, label: "Audit Center" },
    { to: "/super/coordinators", icon: UserCheck, label: "Coordinators" },
    { to: "/super/search", icon: Search, label: "Global Search" },
    { to: "/super/backup", icon: DownloadCloud, label: "Event Export" },
  ];

  const coordinatorLinks = [
    { to: "/coordinator/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/coordinator/students", icon: Users, label: "Class Students" },
    { to: "/coordinator/collection", icon: Coins, label: "Record Payment" },
    { to: "/coordinator/submissions", icon: CheckSquare, label: "My Submissions" },
  ];

  const viewerLinks = [
    { to: "/viewer/dashboard", icon: LayoutDashboard, label: "College Overview" },
    { to: "/viewer/years", icon: GraduationCap, label: "Year-wise Stats" },
    { to: "/viewer/classes", icon: Users, label: "Class-wise Stats" },
  ];

  const assistantLinks = [
    { to: "/collection-assistant/dashboard", icon: Layers, label: "Collection Assistant" },
  ];

  let links = superLinks;
  if (userProfile.role === "class_coordinator") {
    links = [...coordinatorLinks];
    if (isCrossClassAssistant) {
      links.push(...assistantLinks);
    }
  } else if (userProfile.role === "view_coordinator") {
    links = [...viewerLinks];
    if (isCrossClassAssistant) {
      links.push(...assistantLinks);
    }
  } else if (isCrossClassAssistant && !isClassCoordinator && userProfile.role !== "super_coordinator") {
    links = assistantLinks;
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800 bg-slate-950/60 p-4 shrink-0 overflow-y-auto">
      <div className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
};
