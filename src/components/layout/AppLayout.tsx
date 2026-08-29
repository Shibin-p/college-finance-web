import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { MobileNavBar } from "./MobileNavBar";
import { useAuth } from "../../hooks/useAuth";
import {
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
  X,
} from "lucide-react";

export const AppLayout: React.FC = () => {
  const { userProfile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const superLinks = [
    { to: "/super/dashboard", icon: Coins, label: "Dashboard" },
    { to: "/super/events", icon: Calendar, label: "Events" },
    { to: "/super/classes", icon: GraduationCap, label: "Classes" },
    { to: "/super/students", icon: Users, label: "Students" },
    { to: "/super/collection", icon: Coins, label: "Collection Ledger" },
    { to: "/super/approvals", icon: CheckSquare, label: "Approvals Queue" },
    { to: "/super/receipts", icon: Receipt, label: "Central Receipts" },
    { to: "/super/reconciliation", icon: Scale, label: "Reconciliation" },
    { to: "/super/expenses", icon: CreditCard, label: "Expenses" },
    { to: "/super/closing", icon: Clock, label: "Daily Closing" },
    { to: "/super/adjustments", icon: Sliders, label: "Adjustments" },
    { to: "/super/reports", icon: FileSpreadsheet, label: "Reports Center" },
    { to: "/super/audit", icon: History, label: "Audit Center" },
    { to: "/super/coordinators", icon: UserCheck, label: "Coordinators" },
    { to: "/super/search", icon: Search, label: "Global Search" },
    { to: "/super/backup", icon: DownloadCloud, label: "Event Export" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col selection:bg-emerald-500 selection:text-white">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-8 px-3 sm:px-6 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <Footer />

      <MobileNavBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-t border-slate-700 rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                All Modules
              </h3>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {userProfile?.role === "super_coordinator" &&
                superLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold ${
                          isActive
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 text-emerald-400" />
                      <span className="truncate">{link.label}</span>
                    </NavLink>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
