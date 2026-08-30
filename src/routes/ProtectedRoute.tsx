import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import type { UserRole } from "../types";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  requireCrossClassAssistant?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  requireCrossClassAssistant,
}) => {
  const { userProfile, loading: authLoading, currentUser } = useAuth();
  const { isCrossClassAssistant, loading: permsLoading } = usePermissions();

  if (authLoading || permsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-slate-400">Loading EKCTC Finance...</p>
      </div>
    );
  }

  if (!currentUser || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (!userProfile.active || !userProfile.loginEnabled) {
    return <Navigate to="/login" replace />;
  }

  // Cross-Class Assistant capability route guard
  if (requireCrossClassAssistant) {
    if (isCrossClassAssistant || userProfile.role === "super_coordinator") {
      return <Outlet />;
    }
    return <Navigate to="/" replace />;
  }

  // Primary Role route guard
  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    if (userProfile.role === "super_coordinator") {
      return <Navigate to="/super/dashboard" replace />;
    } else if (userProfile.role === "class_coordinator") {
      return <Navigate to="/coordinator/dashboard" replace />;
    } else {
      return <Navigate to="/viewer/dashboard" replace />;
    }
  }

  return <Outlet />;
};
