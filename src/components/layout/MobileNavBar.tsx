import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import {
  LayoutDashboard,
  Users,
  Coins,
  CheckSquare,
  FileText,
  Menu,
  Layers,
} from "lucide-react";

export const MobileNavBar: React.FC<{ onOpenMobileMenu?: () => void }> = ({
  onOpenMobileMenu,
}) => {
  const { userProfile } = useAuth();
  const { isCrossClassAssistant, isClassCoordinator } = usePermissions();
  if (!userProfile) return null;

  const coordinatorTabs = [
    { to: "/coordinator/dashboard", icon: LayoutDashboard, label: "Home" },
    { to: "/coordinator/students", icon: Users, label: "Students" },
    { to: "/coordinator/collection", icon: Coins, label: "Collect" },
    { to: "/coordinator/submissions", icon: CheckSquare, label: "History" },
  ];

  const superTabs = [
    { to: "/super/dashboard", icon: LayoutDashboard, label: "Home" },
    { to: "/super/collection", icon: Coins, label: "Ledger" },
    { to: "/super/approvals", icon: CheckSquare, label: "Approve" },
    { to: "/super/reconciliation", icon: FileText, label: "Reconcile" },
  ];

  const viewerTabs = [
    { to: "/viewer/dashboard", icon: LayoutDashboard, label: "Overview" },
    { to: "/viewer/years", icon: Users, label: "Years" },
    { to: "/viewer/classes", icon: Coins, label: "Classes" },
  ];

  const assistantTabs = [
    { to: "/collection-assistant/dashboard", icon: Layers, label: "Assistant" },
  ];

  let tabs = superTabs;
  if (userProfile.role === "class_coordinator") {
    tabs = coordinatorTabs;
  } else if (userProfile.role === "view_coordinator") {
    tabs = viewerTabs;
  } else if (isCrossClassAssistant && !isClassCoordinator && userProfile.role !== "super_coordinator") {
    tabs = assistantTabs;
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-1.5 safe-area-bottom">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? "text-emerald-400 font-bold scale-105"
                    : "text-slate-400 hover:text-slate-200"
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </NavLink>
          );
        })}

        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="flex flex-col items-center justify-center py-1 px-3 text-slate-400 hover:text-slate-200"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        )}
      </div>
    </div>
  );
};
