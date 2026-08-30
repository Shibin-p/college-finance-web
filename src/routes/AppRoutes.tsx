import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/auth/LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../components/layout/AppLayout";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";

// Super Coordinator Pages
import { SuperDashboard } from "../pages/super/SuperDashboard";
import { EventsManagement } from "../pages/super/EventsManagement";
import { ClassManagement } from "../pages/super/ClassManagement";
import { StudentManagement } from "../pages/super/StudentManagement";
import { CollectionManagement } from "../pages/super/CollectionManagement";
import { ApprovalsManagement } from "../pages/super/ApprovalsManagement";
import { CentralReceiptsPage } from "../pages/super/CentralReceiptsPage";
import { ReconciliationPage } from "../pages/super/ReconciliationPage";
import { ExpensesPage } from "../pages/super/ExpensesPage";
import { DailyClosingPage } from "../pages/super/DailyClosingPage";
import { AdjustmentsPage } from "../pages/super/AdjustmentsPage";
import { ReportsPage } from "../pages/super/ReportsPage";
import { AuditLogsPage } from "../pages/super/AuditLogsPage";
import { CoordinatorsPage } from "../pages/super/CoordinatorsPage";
import { GlobalSearchPage } from "../pages/super/GlobalSearchPage";
import { EventExportPage } from "../pages/super/EventExportPage";

// Class Coordinator Pages
import { CoordinatorDashboard } from "../pages/coordinator/CoordinatorDashboard";
import { ClassStudentsPage } from "../pages/coordinator/ClassStudentsPage";
import { ClassCollectionPage } from "../pages/coordinator/ClassCollectionPage";
import { MySubmissionsPage } from "../pages/coordinator/MySubmissionsPage";

// View-Only Coordinator Pages
import { ViewerDashboard } from "../pages/viewer/ViewerDashboard";
import { ViewerYearStats } from "../pages/viewer/ViewerYearStats";
import { ViewerClassStats } from "../pages/viewer/ViewerClassStats";
import { ViewerExpensesPage } from "../pages/viewer/ViewerExpensesPage";

// Cross-Class Collection Assistant Page
import { CollectionAssistantDashboard } from "../pages/assistant/CollectionAssistantDashboard";

const RootRedirect: React.FC = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const { isCrossClassAssistant, loading: permsLoading } = usePermissions();

  if (authLoading || permsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-semibold">Loading EKCTC Finance...</p>
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile.role === "super_coordinator") {
    return <Navigate to="/super/dashboard" replace />;
  } else if (userProfile.role === "class_coordinator") {
    return <Navigate to="/coordinator/dashboard" replace />;
  } else if (isCrossClassAssistant) {
    return <Navigate to="/collection-assistant/dashboard" replace />;
  } else {
    return <Navigate to="/viewer/dashboard" replace />;
  }
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Super Coordinator Routes */}
      <Route element={<ProtectedRoute allowedRoles={["super_coordinator"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/super/dashboard" element={<SuperDashboard />} />
          <Route path="/super/events" element={<EventsManagement />} />
          <Route path="/super/classes" element={<ClassManagement />} />
          <Route path="/super/students" element={<StudentManagement />} />
          <Route path="/super/collection" element={<CollectionManagement />} />
          <Route path="/super/approvals" element={<ApprovalsManagement />} />
          <Route path="/super/receipts" element={<CentralReceiptsPage />} />
          <Route path="/super/reconciliation" element={<ReconciliationPage />} />
          <Route path="/super/expenses" element={<ExpensesPage />} />
          <Route path="/super/closing" element={<DailyClosingPage />} />
          <Route path="/super/adjustments" element={<AdjustmentsPage />} />
          <Route path="/super/reports" element={<ReportsPage />} />
          <Route path="/super/audit" element={<AuditLogsPage />} />
          <Route path="/super/coordinators" element={<CoordinatorsPage />} />
          <Route path="/super/search" element={<GlobalSearchPage />} />
          <Route path="/super/backup" element={<EventExportPage />} />
        </Route>
      </Route>

      {/* Class Coordinator Routes */}
      <Route
        element={
          <ProtectedRoute allowedRoles={["class_coordinator", "super_coordinator"]} />
        }
      >
        <Route element={<AppLayout />}>
          <Route path="/coordinator/dashboard" element={<CoordinatorDashboard />} />
          <Route path="/coordinator/students" element={<ClassStudentsPage />} />
          <Route path="/coordinator/collection" element={<ClassCollectionPage />} />
          <Route path="/coordinator/submissions" element={<MySubmissionsPage />} />
        </Route>
      </Route>

      {/* Cross-Class Collection Assistant Dedicated Route */}
      <Route
        element={
          <ProtectedRoute requireCrossClassAssistant={true} />
        }
      >
        <Route element={<AppLayout />}>
          <Route
            path="/collection-assistant/dashboard"
            element={<CollectionAssistantDashboard />}
          />
        </Route>
      </Route>

      {/* View-Only Coordinator Routes */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={["view_coordinator", "class_coordinator", "super_coordinator"]}
          />
        }
      >
        <Route element={<AppLayout />}>
          <Route path="/viewer/dashboard" element={<ViewerDashboard />} />
          <Route path="/viewer/years" element={<ViewerYearStats />} />
          <Route path="/viewer/classes" element={<ViewerClassStats />} />
          <Route path="/viewer/expenses" element={<ViewerExpensesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
