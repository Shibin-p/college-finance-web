import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchUsers,
  updateUserProfile,
  fetchCoordinatorAssignments,
  createCoordinatorAssignment,
  updateCoordinatorAssignment,
} from "../../services/coordinatorService";
import type {
  UserProfile,
  CoordinatorAssignmentModel,
  CoordinatorPermissions,
  ViewerScope,
  ViewerPermissions,
  CrossClassCapabilities,
} from "../../types";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/EmptyState";
import {
  UserCheck,
  Sliders,
  Shield,
  Layers,
  Eye,
  CheckSquare,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Unlock,
  Users,
  Check,
} from "lucide-react";
import {
  listCoordinatorAccounts,
  onboardCoordinatorAccount,
  type CoordinatorAccountItem,
} from "../../services/coordinatorOnboardingService";

export const CoordinatorsPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile: currentUser } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<CoordinatorAssignmentModel[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Coordinator Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [onboardMode, setOnboardMode] = useState<"existing" | "new">("existing");

  // Existing Accounts List & Search
  const [authAccounts, setAuthAccounts] = useState<CoordinatorAccountItem[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<CoordinatorAccountItem | null>(null);
  const [accountFilter, setAccountFilter] = useState<"all" | "unconfigured" | "configured">("all");

  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [addRole, setAddRole] = useState<"class_coordinator" | "view_coordinator">("class_coordinator");
  const [addAccountActive, setAddAccountActive] = useState(true);
  const [addLoginEnabled, setAddLoginEnabled] = useState(true);

  // Add Coordinator Permissions State (Strictly Separated Roles & Capabilities)
  const [addClassId, setAddClassId] = useState<string>("");
  const [addClassPerms, setAddClassPerms] = useState<CoordinatorPermissions>({
    canView: true,
    canViewStudents: true,
    canAddPayment: true,
    canAddInstallment: true,
    canEditPayment: false,
    canViewReports: true,
  });

  const [addViewerScope, setAddViewerScope] = useState<ViewerScope>("whole_event");
  const [addViewerClassId, setAddViewerClassId] = useState<string>("");
  const [addViewerPerms, setAddViewerPerms] = useState<ViewerPermissions>({
    canViewAggregate: true,
    canViewStudentCollectionStatus: false,
    canViewExpenses: false,
    canViewExpenseCategories: false,
  });

  const [addCrossClassEnabled, setAddCrossClassEnabled] = useState(false);
  const [addAuthorizedClassIds, setAddAuthorizedClassIds] = useState<string[]>([]);
  const [addCrossClassCaps, setAddCrossClassCaps] = useState<CrossClassCapabilities>({
    canViewCollection: true,
    canAddPayment: true,
    canAddInstallment: true,
    canHandlePendingApprovals: false,
    canAccessCentralReceipts: false,
  });

  const [addOnboardLoading, setAddOnboardLoading] = useState(false);
  const [addOnboardError, setAddOnboardError] = useState("");
  const [addOnboardSuccess, setAddOnboardSuccess] = useState("");

  // Edit / Assign Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [targetAssignment, setTargetAssignment] = useState<CoordinatorAssignmentModel | null>(null);

  // Modal Form State
  const [modalTab, setModalTab] = useState<"class_coord" | "viewer" | "cross_class">("class_coord");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [accountActive, setAccountActive] = useState(true);
  const [loginEnabled, setLoginEnabled] = useState(true);

  // Class Coordinator Perms
  const [classPerms, setClassPerms] = useState<CoordinatorPermissions>({
    canView: true,
    canViewStudents: true,
    canAddPayment: true,
    canAddInstallment: true,
    canEditPayment: false,
    canViewReports: true,
  });

  // Viewer Scope & Perms
  const [viewerScope, setViewerScope] = useState<ViewerScope>("whole_event");
  const [viewerClassId, setViewerClassId] = useState<string>("");
  const [viewerPerms, setViewerPerms] = useState<ViewerPermissions>({
    canViewAggregate: true,
    canViewStudentCollectionStatus: false,
    canViewExpenses: false,
    canViewExpenseCategories: false,
  });

  // Cross-Class Collection Assistant
  const [crossClassEnabled, setCrossClassEnabled] = useState(false);
  const [authorizedClassIds, setAuthorizedClassIds] = useState<string[]>([]);
  const [crossClassCaps, setCrossClassCaps] = useState<CrossClassCapabilities>({
    canViewCollection: true,
    canAddPayment: true,
    canAddInstallment: true,
    canHandlePendingApprovals: false,
    canAccessCentralReceipts: false,
  });

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Quick Account Toggle Dialog
  const [toggleTarget, setToggleTarget] = useState<{
    user: UserProfile;
    field: "active" | "loginEnabled";
    nextValue: boolean;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, aList] = await Promise.all([
        fetchUsers(),
        fetchCoordinatorAssignments(activeEvent?.id),
      ]);
      setUsers(uList);
      setAssignments(aList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeEvent?.id]);

  const classMap = new Map(classes.map((c) => [c.id, c.displayName]));
  const userMap = new Map(users.map((u) => [u.uid, u.name]));

  // Coordinators available for assignment (non-super)
  const assignableUsers = users.filter((u) => u.role !== "super_coordinator");

  const openAssignModal = (user?: UserProfile) => {
    setSaveError("");
    const selectedUser = user || assignableUsers[0] || null;
    setTargetUser(selectedUser);

    // Look for existing assignment in active event
    const existing = assignments.find((a) => a.userId === selectedUser?.uid);
    setTargetAssignment(existing || null);

    if (selectedUser) {
      setAccountActive(selectedUser.active);
      setLoginEnabled(selectedUser.loginEnabled);
    }

    if (existing) {
      setSelectedClassId(existing.classId || (classes[0]?.id || ""));
      setClassPerms(existing.permissions || {
        canView: true,
        canViewStudents: true,
        canAddPayment: true,
        canAddInstallment: true,
        canEditPayment: false,
        canViewReports: true,
      });
      setViewerScope(existing.viewerScope || "whole_event");
      setViewerClassId(existing.classId || "");
      setViewerPerms(existing.viewerPermissions || {
        canViewAggregate: true,
        canViewStudentCollectionStatus: false,
        canViewExpenses: false,
        canViewExpenseCategories: false,
      });
      setCrossClassEnabled(Boolean(existing.crossClassCollection?.enabled));
      setAuthorizedClassIds(existing.crossClassCollection?.authorizedClassIds || []);
      setCrossClassCaps({
        canViewCollection: existing.crossClassCollection?.capabilities?.canViewCollection ?? true,
        canAddPayment: existing.crossClassCollection?.capabilities?.canAddPayment ?? true,
        canAddInstallment: existing.crossClassCollection?.capabilities?.canAddInstallment ?? true,
        canHandlePendingApprovals: existing.crossClassCollection?.capabilities?.canHandlePendingApprovals ?? false,
        canAccessCentralReceipts: existing.crossClassCollection?.capabilities?.canAccessCentralReceipts ?? false,
      });
    } else {
      setSelectedClassId(classes[0]?.id || "");
      setViewerClassId(classes[0]?.id || "");
      setAuthorizedClassIds([]);
      setCrossClassCaps({
        canViewCollection: true,
        canAddPayment: true,
        canAddInstallment: true,
        canHandlePendingApprovals: false,
        canAccessCentralReceipts: false,
      });
    }

    if (selectedUser?.role === "view_coordinator") {
      setModalTab("viewer");
    } else {
      setModalTab("class_coord");
    }
    setEditModalOpen(true);
  };

  const handleSaveAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !activeEvent || !currentUser) return;
    setSaveError("");
    setSaveLoading(true);

    try {
      // 1. Update user profile active / loginEnabled if changed
      if (
        accountActive !== targetUser.active ||
        loginEnabled !== targetUser.loginEnabled
      ) {
        await updateUserProfile(
          targetUser.uid,
          { active: accountActive, loginEnabled },
          currentUser
        );
      }

      // 2. Determine assignment payload
      const isViewer = targetUser.role === "view_coordinator";
      const assignmentPayload: Partial<CoordinatorAssignmentModel> = {
        userId: targetUser.uid,
        eventId: activeEvent.id,
        assignmentType: isViewer ? "view_coordinator" : "class_coordinator",
        classId: isViewer ? (viewerScope === "specific_class" ? viewerClassId : "") : selectedClassId,
        active: true,
        permissions: classPerms,
        viewerScope,
        viewerPermissions: viewerPerms,
        crossClassCollection: {
          enabled: crossClassEnabled,
          authorizedClassIds,
          capabilities: crossClassCaps,
        },
      };

      if (targetAssignment) {
        await updateCoordinatorAssignment(targetAssignment.id, assignmentPayload, currentUser);
      } else {
        await createCoordinatorAssignment(
          {
            userId: targetUser.uid,
            eventId: activeEvent.id,
            assignmentType: assignmentPayload.assignmentType,
            classId: assignmentPayload.classId,
            permissions: classPerms,
            viewerScope,
            viewerPermissions: viewerPerms,
            crossClassCollection: assignmentPayload.crossClassCollection,
          },
          currentUser
        );
      }

      await loadData();
      setEditModalOpen(false);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update coordinator access.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleToggleConfirm = async () => {
    if (!toggleTarget || !currentUser) return;
    try {
      await updateUserProfile(
        toggleTarget.user.uid,
        { [toggleTarget.field]: toggleTarget.nextValue },
        currentUser
      );
      await loadData();
      setToggleTarget(null);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAuthorizedClass = (clsId: string) => {
    if (authorizedClassIds.includes(clsId)) {
      setAuthorizedClassIds(authorizedClassIds.filter((id) => id !== clsId));
    } else {
      setAuthorizedClassIds([...authorizedClassIds, clsId]);
    }
  };

  const loadAuthAccounts = async () => {
    if (!activeEvent) return;
    setAccountsLoading(true);
    setAccountsError("");
    try {
      const list = await listCoordinatorAccounts(activeEvent.id);
      setAuthAccounts(list);
    } catch (err: any) {
      console.error("Failed to load coordinator accounts:", err);
      setAccountsError(err.message || "Failed to load Firebase Authentication accounts.");
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleSelectAccount = (acc: CoordinatorAccountItem) => {
    setSelectedAccount(acc);
    setAddEmail(acc.email);
    setAddName(acc.displayName || acc.firestoreName || acc.email.split("@")[0]);
    if (acc.firestoreRole === "class_coordinator" || acc.firestoreRole === "view_coordinator") {
      setAddRole(acc.firestoreRole);
    }
    if (acc.assignedClassId) {
      setAddClassId(acc.assignedClassId);
    }
    if (acc.viewerScope) {
      setAddViewerScope(acc.viewerScope as ViewerScope);
    }
    if (acc.crossClassEnabled) {
      setAddCrossClassEnabled(true);
    }
  };

  const openAddCoordinatorModal = () => {
    setOnboardMode("existing");
    setSelectedAccount(null);
    setAccountSearch("");
    setAccountFilter("all");
    setAddEmail("");
    setAddName("");
    setAddPassword("");
    setShowPassword(false);
    setAddRole("class_coordinator");
    setAddAccountActive(true);
    setAddLoginEnabled(true);
    setAddClassId(classes[0]?.id || "");
    setAddViewerClassId(classes[0]?.id || "");
    setAddViewerScope("whole_event");
    setAddClassPerms({
      canView: true,
      canViewStudents: true,
      canAddPayment: true,
      canAddInstallment: true,
      canEditPayment: false,
      canViewReports: true,
    });
    setAddViewerPerms({
      canViewAggregate: true,
      canViewStudentCollectionStatus: false,
      canViewExpenses: false,
      canViewExpenseCategories: false,
    });
    setAddCrossClassEnabled(false);
    setAddAuthorizedClassIds([]);
    setAddCrossClassCaps({
      canViewCollection: true,
      canAddPayment: true,
      canAddInstallment: true,
      canHandlePendingApprovals: false,
      canAccessCentralReceipts: false,
    });
    setAddOnboardError("");
    setAddOnboardSuccess("");
    setAddModalOpen(true);
    loadAuthAccounts();
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !currentUser) return;
    setAddOnboardError("");
    setAddOnboardSuccess("");

    if (onboardMode === "existing") {
      if (!selectedAccount) {
        setAddOnboardError("Please select an existing Firebase Authentication account from the list.");
        return;
      }
      if (!addName.trim()) {
        setAddOnboardError("Coordinator name is required.");
        return;
      }
    } else {
      if (!addEmail.trim()) {
        setAddOnboardError("Email address is required.");
        return;
      }
      if (!addPassword || addPassword.length < 6) {
        setAddOnboardError("Password must be at least 6 characters for new accounts.");
        return;
      }
      if (!addName.trim()) {
        setAddOnboardError("Coordinator full name is required.");
        return;
      }
    }

    if (addRole === "class_coordinator" && !addClassId) {
      setAddOnboardError("Please select an assigned class for the Class Coordinator.");
      return;
    }

    if (addCrossClassEnabled && addAuthorizedClassIds.length === 0) {
      setAddOnboardError("Please select at least one authorized class for the Cross-Class Collection Assistant.");
      return;
    }

    setAddOnboardLoading(true);
    try {
      const res = await onboardCoordinatorAccount({
        email: onboardMode === "existing" && selectedAccount ? selectedAccount.email : addEmail.trim(),
        name: addName.trim(),
        password: onboardMode === "new" ? addPassword : undefined,
        role: addRole,
        accountActive: addAccountActive,
        loginEnabled: addLoginEnabled,
        eventId: activeEvent.id,
        classId: addRole === "class_coordinator" ? addClassId : (addViewerScope === "specific_class" ? addViewerClassId : undefined),
        assignmentType: addRole,
        permissions: addClassPerms,
        viewerScope: addViewerScope,
        viewerPermissions: addViewerPerms,
        crossClassCollection: {
          enabled: addCrossClassEnabled,
          authorizedClassIds: addAuthorizedClassIds,
          capabilities: addCrossClassCaps,
        },
        existingUid: onboardMode === "existing" && selectedAccount ? selectedAccount.uid : undefined,
      });

      setAddOnboardSuccess(res.message);
      await loadData();
      loadAuthAccounts();
      setTimeout(() => {
        setAddModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setAddOnboardError(err.message || "Failed to onboard coordinator.");
    } finally {
      setAddOnboardLoading(false);
    }
  };

  const toggleAddAuthorizedClass = (clsId: string) => {
    if (addAuthorizedClassIds.includes(clsId)) {
      setAddAuthorizedClassIds(addAuthorizedClassIds.filter((id) => id !== clsId));
    } else {
      setAddAuthorizedClassIds([...addAuthorizedClassIds, clsId]);
    }
  };

  const filteredAccounts = authAccounts.filter((acc) => {
    const query = accountSearch.toLowerCase().trim();
    const matchQuery =
      !query ||
      acc.email.toLowerCase().includes(query) ||
      (acc.displayName && acc.displayName.toLowerCase().includes(query)) ||
      (acc.firestoreName && acc.firestoreName.toLowerCase().includes(query)) ||
      (acc.assignedClassName && acc.assignedClassName.toLowerCase().includes(query));

    if (!matchQuery) return false;

    if (accountFilter === "unconfigured") {
      return !acc.hasFirestoreProfile || !acc.hasEventAssignment;
    }
    if (accountFilter === "configured") {
      return acc.hasFirestoreProfile && acc.hasEventAssignment;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Access Governance
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Coordinator Access & Permissions
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure granular class coordinator permissions, viewer scopes, and cross-class collection assistant capabilities with instant real-time sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openAddCoordinatorModal()}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Coordinator</span>
          </button>

          <button
            type="button"
            onClick={() => openAssignModal()}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Assign Existing</span>
          </button>
        </div>
      </div>

      {/* Coordinator Assignments Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Configured Assignments ({activeEvent?.name})
            </h3>
            <p className="text-xs text-slate-400">
              Granular access rules and scopes applied to each coordinator account
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {assignments.length} assignments
          </span>
        </div>

        {assignments.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={UserCheck}
              title="No Assignments in this Event"
              description="Assign coordinators to specific classes or grant cross-class collection assistant access."
              actionLabel="Create Assignment"
              onAction={() => openAssignModal()}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Coordinator</th>
                  <th className="py-3 px-4">Assigned Class</th>
                  <th className="py-3 px-4 text-center">Fund Collection</th>
                  <th className="py-3 px-4 text-center">Installments</th>
                  <th className="py-3 px-4 text-center">Cross-Class Assistant</th>
                  <th className="py-3 px-4 text-center">Viewer Scope</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {assignments.map((a) => {
                  const userObj = users.find((u) => u.uid === a.userId);
                  const isCross = Boolean(a.crossClassCollection?.enabled);
                  const crossCount = a.crossClassCollection?.authorizedClassIds?.length || 0;

                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-100 block">
                          {userMap.get(a.userId) || a.userId}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {userObj?.email}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">
                        {classMap.get(a.classId || "") || a.classId || "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.permissions?.canAddPayment
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {a.permissions?.canAddPayment ? "Allowed" : "Blocked"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.permissions?.canAddInstallment
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {a.permissions?.canAddInstallment ? "Allowed" : "Blocked"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isCross ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300">
                            Active ({crossCount} Classes)
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Disabled</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] font-mono text-slate-400 capitalize">
                          {a.viewerScope === "specific_class" ? "Class Only" : "Whole Event"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openAssignModal(userObj)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Edit Access</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* System Users Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            All Registered Accounts ({users.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">Authentication Identity Store</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-100">{u.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                      {u.role.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.active && u.loginEnabled
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-950 text-rose-400 border border-rose-800"
                      }`}
                    >
                      {u.active && u.loginEnabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.role !== "super_coordinator" && (
                        <>
                          <button
                            type="button"
                            onClick={() => openAssignModal(u)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                          >
                            Edit Access
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setToggleTarget({
                                user: u,
                                field: "loginEnabled",
                                nextValue: !u.loginEnabled,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              u.loginEnabled
                                ? "bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/30 text-rose-300"
                                : "bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/30 text-emerald-300"
                            }`}
                          >
                            {u.loginEnabled ? "Disable" : "Enable"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Edit / Assign Access Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Configure Coordinator Access & Permissions"
        subtitle={`User: ${targetUser?.name || "Coordinator"} (${targetUser?.email}) • Event: ${activeEvent?.name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveAccess} className="space-y-6">
          {saveError && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {saveError}
            </div>
          )}

          {/* Section 1: Coordinator Selector (if multiple) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              Coordinator Account
            </label>
            <select
              value={targetUser?.uid || ""}
              onChange={(e) => {
                const found = users.find((u) => u.uid === e.target.value);
                if (found) openAssignModal(found);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {assignableUsers.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name} ({u.email}) - {u.role.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Section 2: Account Status Controls */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>1. Account Status & Login State</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accountActive}
                  onChange={(e) => setAccountActive(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block">Account Active</span>
                  <span className="text-[10px] text-slate-400">Allows account to exist in rosters</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loginEnabled}
                  onChange={(e) => setLoginEnabled(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block">Login Enabled</span>
                  <span className="text-[10px] text-slate-400">Allows authentication into the portal</span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Navigation Tabs for Specific Scopes */}
          <div className="space-y-4">
            <div className="flex border-b border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => setModalTab("class_coord")}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  modalTab === "class_coord"
                    ? "border-emerald-500 text-emerald-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Class Coordinator</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab("viewer")}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  modalTab === "viewer"
                    ? "border-emerald-500 text-emerald-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Coordinator Scope</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab("cross_class")}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  modalTab === "cross_class"
                    ? "border-emerald-500 text-emerald-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Cross-Class Assistant</span>
              </button>
            </div>

            {/* TAB 1: Normal Class Coordinator */}
            {modalTab === "class_coord" && (
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
                    Assigned Academic Class *
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.displayName} ({cls.department} - Year {cls.year})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Granular Collection Permissions
                  </h5>

                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={classPerms.canView}
                      onChange={(e) => setClassPerms({ ...classPerms, canView: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold block">View Class Roster & Data</span>
                      <span className="text-[10px] text-slate-400">Access class student lists and targets</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={classPerms.canAddPayment}
                      onChange={(e) =>
                        setClassPerms({ ...classPerms, canAddPayment: e.target.checked })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold block">Record Full Fund Payments</span>
                      <span className="text-[10px] text-slate-400">
                        Collect and submit direct student contributions for Super Coordinator approval
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={classPerms.canAddInstallment}
                      onChange={(e) =>
                        setClassPerms({ ...classPerms, canAddInstallment: e.target.checked })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold block">Record Partial Installments</span>
                      <span className="text-[10px] text-slate-400">
                        Accept flexible installment amounts (e.g. ₹100, ₹250)
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={classPerms.canViewReports}
                      onChange={(e) =>
                        setClassPerms({ ...classPerms, canViewReports: e.target.checked })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold block">View Submission History & Reports</span>
                      <span className="text-[10px] text-slate-400">Track approval status of submitted records</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: View Coordinator */}
            {modalTab === "viewer" && (
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
                    Viewing Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setViewerScope("whole_event")}
                      className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                        viewerScope === "whole_event"
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className="block">Whole Event / College</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Aggregated college & year-level summaries
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewerScope("specific_class")}
                      className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                        viewerScope === "specific_class"
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className="block">Specific Class Only</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Restricted strictly to one class
                      </span>
                    </button>
                  </div>
                </div>

                {viewerScope === "specific_class" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
                      Select Scope Class *
                    </label>
                    <select
                      value={viewerClassId}
                      onChange={(e) => setViewerClassId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.displayName} ({cls.department})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Granular Viewer Permissions
                  </h5>

                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={viewerPerms.canViewAggregate}
                      onChange={(e) =>
                        setViewerPerms({ ...viewerPerms, canViewAggregate: e.target.checked })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold block">View Aggregate Financial Statistics</span>
                      <span className="text-[10px] text-slate-400">Total target, collection %, student count</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={viewerPerms.canViewStudentCollectionStatus}
                      onChange={(e) =>
                        setViewerPerms({
                          ...viewerPerms,
                          canViewStudentCollectionStatus: e.target.checked,
                        })
                      }
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold block">View Student-Level Collection Status</span>
                      <span className="text-[10px] text-slate-400">
                        Search student payment status (Waiver & exemption details strictly hidden)
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={viewerPerms.canViewExpenses}
                      onChange={(e) => {
                        const nextVal = e.target.checked;
                        setViewerPerms({
                          ...viewerPerms,
                          canViewExpenses: nextVal,
                          canViewExpenseCategories: nextVal
                            ? viewerPerms.canViewExpenseCategories
                            : false,
                        });
                      }}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold block">View Overall Expenditure Totals</span>
                      <span className="text-[10px] text-slate-400">Total event money spent and balance summaries</span>
                    </div>
                  </label>

                  {viewerPerms.canViewExpenses && (
                    <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 ml-4 rounded-lg bg-slate-900/60 border border-slate-800 hover:bg-slate-900">
                      <input
                        type="checkbox"
                        checked={viewerPerms.canViewExpenseCategories}
                        onChange={(e) =>
                          setViewerPerms({
                            ...viewerPerms,
                            canViewExpenseCategories: e.target.checked,
                          })
                        }
                        className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                      />
                      <div>
                        <span className="font-semibold text-emerald-300 block">
                          View Category-Wise Expense Breakdown
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Display itemized category breakdown (Food, Sound, Custom Categories)
                        </span>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Cross-Class Collection Assistant */}
            {modalTab === "cross_class" && (
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crossClassEnabled}
                    onChange={(e) => setCrossClassEnabled(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-teal-500 h-4 w-4"
                  />
                  <div>
                    <span className="font-bold text-teal-300 block">
                      Enable Cross-Class Collection Access
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Allows this coordinator to assist with collection across multiple explicitly selected classes
                    </span>
                  </div>
                </label>

                {crossClassEnabled && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
                        Authorized Classes Multi-Select * ({authorizedClassIds.length} Selected)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-2 bg-slate-900 rounded-xl border border-slate-800">
                        {classes.map((cls) => {
                          const isSelected = authorizedClassIds.includes(cls.id);
                          return (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => toggleAuthorizedClass(cls.id)}
                              className={`p-2 rounded-lg text-xs font-semibold text-left border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              <span className="block truncate">{cls.displayName}</span>
                              <span className="text-[10px] text-slate-500 block">{cls.department}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        Assistant Collection Capabilities
                      </h5>

                      <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                        <input
                          type="checkbox"
                          checked={crossClassCaps.canViewCollection}
                          onChange={(e) =>
                            setCrossClassCaps({
                              ...crossClassCaps,
                              canViewCollection: e.target.checked,
                            })
                          }
                          className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                        />
                        <div>
                          <span className="font-semibold block">View Collection & Pending Lists</span>
                          <span className="text-[10px] text-slate-400">See students with pending balances</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                        <input
                          type="checkbox"
                          checked={crossClassCaps.canAddPayment}
                          onChange={(e) =>
                            setCrossClassCaps({
                              ...crossClassCaps,
                              canAddPayment: e.target.checked,
                            })
                          }
                          className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                        />
                        <div>
                          <span className="font-semibold block">Record Full Payments</span>
                          <span className="text-[10px] text-slate-400">Accept and log full student payments</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                        <input
                          type="checkbox"
                          checked={crossClassCaps.canAddInstallment}
                          onChange={(e) =>
                            setCrossClassCaps({
                              ...crossClassCaps,
                              canAddInstallment: e.target.checked,
                            })
                          }
                          className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                        />
                        <div>
                          <span className="font-semibold block">Record Installments</span>
                          <span className="text-[10px] text-slate-400">Record partial installment contributions</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                        <input
                          type="checkbox"
                          checked={crossClassCaps.canHandlePendingApprovals}
                          onChange={(e) =>
                            setCrossClassCaps({
                              ...crossClassCaps,
                              canHandlePendingApprovals: e.target.checked,
                            })
                          }
                          className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                        />
                        <div>
                          <span className="font-semibold block">Handle Pending Approvals</span>
                          <span className="text-[10px] text-slate-400">
                            Approve/decline other payments in authorized classes (Self-approval strictly prevented)
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                        <input
                          type="checkbox"
                          checked={crossClassCaps.canAccessCentralReceipts || false}
                          onChange={(e) =>
                            setCrossClassCaps({
                              ...crossClassCaps,
                              canAccessCentralReceipts: e.target.checked,
                            })
                          }
                          className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                        />
                        <div>
                          <span className="font-semibold block">Access Central Receipts</span>
                          <span className="text-[10px] text-slate-400">
                            Record central cash/digital receipts for authorized classes
                          </span>
                        </div>
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saveLoading ? "Saving Permissions..." : "Save Coordinator Access"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Automated Add / Onboard Coordinator Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add & Onboard Coordinator"
        subtitle={`Event: ${activeEvent?.name || "Active Event"} • Automated Firebase Auth & Firestore Linking`}
        maxWidth="lg"
      >
        <form onSubmit={handleOnboardSubmit} className="space-y-6">
          {addOnboardError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{addOnboardError}</span>
            </div>
          )}

          {addOnboardSuccess && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{addOnboardSuccess}</span>
            </div>
          )}

          {/* Top Options: Option A (Select Existing) vs Option B (Create New) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              How would you like to add the coordinator?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setOnboardMode("existing");
                  setAddOnboardError("");
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  onboardMode === "existing"
                    ? "bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/40 text-white"
                    : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    onboardMode === "existing" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5 text-slate-100">
                    <span>Select Existing Firebase Account</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      50+ Accounts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Choose from existing Firebase Auth accounts. Passwords and credentials remain untouched.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOnboardMode("new");
                  setAddOnboardError("");
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  onboardMode === "new"
                    ? "bg-blue-500/15 border-blue-500/50 ring-1 ring-blue-500/40 text-white"
                    : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    onboardMode === "new" ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100">Create New Firebase Account</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Create a brand-new Firebase Auth user with email, initial password, and permissions.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Option A: Search & Select Existing Firebase Account */}
          {onboardMode === "existing" && (
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Existing Firebase Authentication Accounts ({authAccounts.length})</span>
                </label>
                <button
                  type="button"
                  onClick={loadAuthAccounts}
                  disabled={accountsLoading}
                  className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${accountsLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by email, name, or assigned class..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAccountFilter("all")}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      accountFilter === "all"
                        ? "bg-slate-700 text-white border-slate-600"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    All ({authAccounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountFilter("unconfigured")}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      accountFilter === "unconfigured"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    Not Configured
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountFilter("configured")}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      accountFilter === "configured"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    Configured
                  </button>
                </div>
              </div>

              {/* Loading indicator */}
              {accountsLoading && (
                <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Loading all 50+ Firebase Authentication accounts...</span>
                </div>
              )}

              {/* Error indicator */}
              {accountsError && !accountsLoading && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>Failed to load Firebase Authentication accounts</span>
                  </div>
                  <p className="text-[11px] text-slate-300">{accountsError}</p>
                  <button
                    type="button"
                    onClick={loadAuthAccounts}
                    className="px-3 py-1 bg-rose-900/60 hover:bg-rose-800/60 border border-rose-600/50 rounded-lg text-[11px] font-semibold text-rose-200 cursor-pointer"
                  >
                    Retry Loading
                  </button>
                </div>
              )}

              {/* Scrollable list of accounts */}
              {!accountsLoading && !accountsError && (
                <div className="max-h-60 overflow-y-auto space-y-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  {filteredAccounts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No Firebase Authentication accounts found matching "{accountSearch}".
                    </div>
                  ) : (
                    filteredAccounts.map((acc) => {
                      const isSelected = selectedAccount?.uid === acc.uid;
                      return (
                        <div
                          key={acc.uid}
                          onClick={() => handleSelectAccount(acc)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-emerald-950/60 border-emerald-500/60 ring-1 ring-emerald-500/40"
                              : "bg-slate-900/60 hover:bg-slate-800/60 border-slate-800/80"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold font-mono text-slate-100">{acc.email}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                  acc.disabled
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                }`}
                              >
                                {acc.disabled ? "Disabled in Auth" : "Active"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                              {acc.displayName && (
                                <span className="text-slate-300 font-medium">{acc.displayName} •</span>
                              )}
                              <span>
                                Finance Profile:{" "}
                                {acc.hasFirestoreProfile ? (
                                  <span className="text-emerald-400 font-semibold">Configured ({acc.firestoreRole || "Coordinator"})</span>
                                ) : (
                                  <span className="text-amber-400 font-semibold">Not Configured</span>
                                )}
                              </span>
                              <span>•</span>
                              <span>
                                Assignment:{" "}
                                {acc.hasEventAssignment ? (
                                  <span className="text-teal-300 font-semibold">
                                    {acc.assignedClassName || acc.assignmentType || "Assigned"}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Not Assigned</span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isSelected ? (
                              <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg border border-slate-700"
                              >
                                Select
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Selected account summary badge */}
              {selectedAccount && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Selected: {selectedAccount.email}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300">
                      UID: {selectedAccount.uid}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Existing Firebase Authentication credentials, password, and status remain untouched. No password required.
                  </p>
                  {selectedAccount.hasEventAssignment && (
                    <div className="text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-500/30">
                      Notice: User is already assigned to this event ({selectedAccount.assignedClassName || selectedAccount.assignmentType}). Submitting will update their assignment and permissions rather than creating a duplicate.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Option B: Create New Firebase Account */}
          {onboardMode === "new" && (
            <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30 space-y-3">
              <div className="flex items-center gap-2 font-bold text-blue-300 text-xs">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span>New Firebase Authentication Account Details</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Enter the email and initial login password. A new Firebase Authentication account will be created directly on the server.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required={onboardMode === "new"}
                    placeholder="coordinator@college.edu"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    Initial Password (Min 6 chars) *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={onboardMode === "new"}
                      minLength={6}
                      placeholder="••••••••"
                      value={addPassword}
                      onChange={(e) => setAddPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Account Details & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Coordinator Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Alex Morgan"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Primary Coordinator Role *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAddRole("class_coordinator")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    addRole === "class_coordinator"
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Class Coord</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAddRole("view_coordinator")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    addRole === "view_coordinator"
                      ? "bg-teal-500/20 border-teal-500/50 text-teal-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Coord</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Initial Status Toggles */}
          <div className="flex items-center gap-6 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={addAccountActive}
                onChange={(e) => setAddAccountActive(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
              />
              <span className="font-semibold">Account Active</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={addLoginEnabled}
                onChange={(e) => setAddLoginEnabled(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
              />
              <span className="font-semibold">Login Enabled</span>
            </label>
          </div>

          {/* Section 4: Role-Specific Assignment Configuration */}
          {addRole === "class_coordinator" && (
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Class Coordinator Assignment & Permissions</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                  Assigned Class *
                </label>
                <select
                  value={addClassId}
                  onChange={(e) => setAddClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.displayName} ({cls.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addClassPerms.canView}
                    onChange={(e) => setAddClassPerms({ ...addClassPerms, canView: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                  />
                  <span>View Collection Dashboard</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addClassPerms.canViewStudents}
                    onChange={(e) => setAddClassPerms({ ...addClassPerms, canViewStudents: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                  />
                  <span>View Student Roster</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addClassPerms.canAddPayment}
                    onChange={(e) => setAddClassPerms({ ...addClassPerms, canAddPayment: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                  />
                  <span>Record Direct Payments</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addClassPerms.canAddInstallment}
                    onChange={(e) => setAddClassPerms({ ...addClassPerms, canAddInstallment: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                  />
                  <span>Record Installments</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addClassPerms.canViewReports}
                    onChange={(e) => setAddClassPerms({ ...addClassPerms, canViewReports: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                  />
                  <span>View Class Reports</span>
                </label>
              </div>
            </div>
          )}

          {addRole === "view_coordinator" && (
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-teal-400" />
                <span>View Coordinator Scope & Permissions</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                  Viewer Scope *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddViewerScope("whole_event")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      addViewerScope === "whole_event"
                        ? "bg-teal-500/20 border-teal-500/50 text-teal-300"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Whole College / Event
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddViewerScope("specific_class")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      addViewerScope === "specific_class"
                        ? "bg-teal-500/20 border-teal-500/50 text-teal-300"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Specific Class
                  </button>
                </div>
              </div>

              {addViewerScope === "specific_class" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                    Scoped Class *
                  </label>
                  <select
                    value={addViewerClassId}
                    onChange={(e) => setAddViewerClassId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.displayName} ({cls.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addViewerPerms.canViewAggregate}
                    onChange={(e) => setAddViewerPerms({ ...addViewerPerms, canViewAggregate: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                  />
                  <span>View Aggregate Statistics</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addViewerPerms.canViewStudentCollectionStatus}
                    onChange={(e) => setAddViewerPerms({ ...addViewerPerms, canViewStudentCollectionStatus: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                  />
                  <span>View Student Payment Status</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addViewerPerms.canViewExpenses}
                    onChange={(e) => setAddViewerPerms({ ...addViewerPerms, canViewExpenses: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                  />
                  <span>View Expenditures Ledger</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={addViewerPerms.canViewExpenseCategories}
                    onChange={(e) => setAddViewerPerms({ ...addViewerPerms, canViewExpenseCategories: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                  />
                  <span>View Expense Categories Breakdown</span>
                </label>
              </div>
            </div>
          )}

          {/* Section 5: Cross-Class Collection Assistant Capability (Independent Extension) */}
          <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-teal-300 uppercase tracking-wider cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addCrossClassEnabled}
                    onChange={(e) => setAddCrossClassEnabled(e.target.checked)}
                    className="rounded bg-slate-900 border-teal-700 text-teal-500 h-4 w-4"
                  />
                  <span>Cross-Class Collection Assistant Capability</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Grant this coordinator field collection capability across multiple authorized classes. Does NOT grant primary permissions.
                </p>
              </div>
            </div>

            {addCrossClassEnabled && (
              <div className="space-y-3 pt-2 border-t border-teal-500/20">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase">
                      Authorized Classes ({addAuthorizedClassIds.length}/{classes.length}) *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (addAuthorizedClassIds.length === classes.length) {
                          setAddAuthorizedClassIds([]);
                        } else {
                          setAddAuthorizedClassIds(classes.map((c) => c.id));
                        }
                      }}
                      className="text-[10px] text-teal-400 hover:text-teal-300 underline font-semibold cursor-pointer"
                    >
                      {addAuthorizedClassIds.length === classes.length ? "Clear All" : "Authorize All Classes"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {classes.map((cls) => {
                      const isAuth = addAuthorizedClassIds.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => toggleAddAuthorizedClass(cls.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                            isAuth
                              ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {cls.displayName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={addCrossClassCaps.canViewCollection}
                      onChange={(e) => setAddCrossClassCaps({ ...addCrossClassCaps, canViewCollection: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                    />
                    <span>Can View Collection Rosters</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={addCrossClassCaps.canAddPayment}
                      onChange={(e) => setAddCrossClassCaps({ ...addCrossClassCaps, canAddPayment: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                    />
                    <span>Record Full Payments</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={addCrossClassCaps.canAddInstallment}
                      onChange={(e) => setAddCrossClassCaps({ ...addCrossClassCaps, canAddInstallment: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                    />
                    <span>Record Installments</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={addCrossClassCaps.canHandlePendingApprovals}
                      onChange={(e) => setAddCrossClassCaps({ ...addCrossClassCaps, canHandlePendingApprovals: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                    />
                    <span>Handle Pending Approvals</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={addCrossClassCaps.canAccessCentralReceipts || false}
                      onChange={(e) => setAddCrossClassCaps({ ...addCrossClassCaps, canAccessCentralReceipts: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-teal-500 h-4 w-4"
                    />
                    <div>
                      <span className="font-semibold block">Access Central Receipts</span>
                      <span className="text-[10px] text-slate-400">Record physical handover receipts into central custody</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addOnboardLoading}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-teal-600/25"
            >
              {addOnboardLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Onboarding Coordinator...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{onboardMode === "existing" ? "Link Existing Coordinator Account" : "Create & Onboard Coordinator"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toggle Status Confirmation Dialog */}
      {toggleTarget && (
        <ConfirmDialog
          isOpen={!!toggleTarget}
          onClose={() => setToggleTarget(null)}
          onConfirm={handleToggleConfirm}
          title={toggleTarget.nextValue ? "Enable Account Access" : "Disable Account Access"}
          message={`Are you sure you want to ${
            toggleTarget.nextValue ? "enable" : "disable"
          } login access for ${toggleTarget.user.name} (${toggleTarget.user.email})?`}
          confirmLabel={toggleTarget.nextValue ? "Enable" : "Disable"}
          variant={toggleTarget.nextValue ? "success" : "danger"}
        />
      )}
    </div>
  );
};
