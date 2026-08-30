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
  Plus,
  Sliders,
  Shield,
  Layers,
  Eye,
  CheckSquare,
} from "lucide-react";

export const CoordinatorsPage: React.FC = () => {
  const { activeEvent, classes } = useEvent();
  const { userProfile: currentUser } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<CoordinatorAssignmentModel[]>([]);
  const [loading, setLoading] = useState(false);

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
      setCrossClassCaps(existing.crossClassCollection?.capabilities || {
        canViewCollection: true,
        canAddPayment: true,
        canAddInstallment: true,
        canHandlePendingApprovals: false,
      });
    } else {
      setSelectedClassId(classes[0]?.id || "");
      setViewerClassId(classes[0]?.id || "");
      setAuthorizedClassIds([]);
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

        <button
          onClick={() => openAssignModal()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Assign / Configure Coordinator</span>
        </button>
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
