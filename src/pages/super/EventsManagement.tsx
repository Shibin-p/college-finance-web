import React, { useState } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  createEvent,
  updateEvent,
  setEventStatus,
  duplicateEvent,
} from "../../services/eventService";
import type { EventModel, EventStatus } from "../../types";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { StatusBadge } from "../../components/common/StatusBadge";
import { formatINR } from "../../utils/formatters";
import {
  Plus,
  Copy,
  Settings,
  Lock,
  Unlock,
  Archive,
} from "lucide-react";

export const EventsManagement: React.FC = () => {
  const { events, activeEvent, setActiveEvent, refreshEvents } = useEvent();
  const { userProfile } = useAuth();

  // Create event modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultTargetAmount, setDefaultTargetAmount] = useState(500);
  const [targetAmountEnabled, setTargetAmountEnabled] = useState(true);
  const [installmentsEnabled, setInstallmentsEnabled] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit settings modal state
  const [editEvent, setEditEvent] = useState<EventModel | null>(null);

  // Duplicate modal state
  const [duplicateTarget, setDuplicateTarget] = useState<EventModel | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  // Status confirm dialog state
  const [statusDialogEvent, setStatusDialogEvent] = useState<{
    event: EventModel;
    nextStatus: EventStatus;
  } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setFormError("");

    if (!name.trim()) {
      setFormError("Event name is required");
      return;
    }

    setCreateLoading(true);
    try {
      const created = await createEvent(
        {
          name,
          description,
          defaultTargetAmount: Number(defaultTargetAmount),
          targetAmountEnabled,
          installmentsEnabled,
          approvalRequired,
        },
        userProfile
      );
      await refreshEvents();
      setActiveEvent(created);
      setCreateModalOpen(false);
      setName("");
      setDescription("");
    } catch (err: any) {
      setFormError(err.message || "Failed to create event");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEvent || !userProfile) return;

    setCreateLoading(true);
    try {
      await updateEvent(
        editEvent.id,
        {
          name: editEvent.name,
          description: editEvent.description,
          defaultTargetAmount: Number(editEvent.defaultTargetAmount),
          targetAmountEnabled: editEvent.targetAmountEnabled,
          installmentsEnabled: editEvent.installmentsEnabled,
          approvalRequired: editEvent.approvalRequired,
        },
        userProfile
      );
      await refreshEvents();
      setEditEvent(null);
    } catch (err: any) {
      setFormError(err.message || "Failed to update event");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateTarget || !userProfile || !duplicateName.trim()) return;
    setDuplicateLoading(true);
    try {
      const created = await duplicateEvent(duplicateTarget.id, duplicateName, userProfile);
      await refreshEvents();
      setActiveEvent(created);
      setDuplicateTarget(null);
      setDuplicateName("");
    } catch (err) {
      console.error(err);
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusDialogEvent || !userProfile) return;
    try {
      await setEventStatus(statusDialogEvent.event.id, statusDialogEvent.nextStatus, userProfile);
      await refreshEvents();
      setStatusDialogEvent(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Event Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create and configure independent financial environments for college programs and fests.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((ev) => {
          const isSelected = activeEvent?.id === ev.id;
          return (
            <div
              key={ev.id}
              className={`glass-panel p-5 rounded-2xl border transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "border-emerald-500/50 bg-slate-900/90 shadow-lg shadow-emerald-950/30"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">{ev.name}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                      {ev.description || "No description provided."}
                    </p>
                  </div>
                  <StatusBadge status={ev.status} size="sm" />
                </div>

                <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target / Student:</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {ev.targetAmountEnabled ? formatINR(ev.defaultTargetAmount) : "Flexible / None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Installment Mode:</span>
                    <span className="font-semibold text-slate-200">
                      {ev.installmentsEnabled ? "Enabled" : "Single Lump Sum"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Approvals:</span>
                    <span className="font-semibold text-slate-200">
                      {ev.approvalRequired ? "Super Approval Req." : "Auto Approved"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveEvent(ev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  {isSelected ? "Active Workspace" : "Switch To"}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setDuplicateTarget(ev);
                      setDuplicateName(`${ev.name} (Copy)`);
                    }}
                    title="Duplicate Configuration"
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setEditEvent(ev)}
                    title="Settings"
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {ev.status === "active" && (
                    <button
                      onClick={() => setStatusDialogEvent({ event: ev, nextStatus: "closed" })}
                      title="Close Event"
                      className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded-xl transition-colors cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                  )}

                  {ev.status === "closed" && (
                    <>
                      <button
                        onClick={() => setStatusDialogEvent({ event: ev, nextStatus: "active" })}
                        title="Reopen Event"
                        className="px-2.5 py-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/30 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Unlock className="w-4 h-4" />
                        <span className="text-xs font-bold">Reopen Event</span>
                      </button>

                      <button
                        onClick={() => setStatusDialogEvent({ event: ev, nextStatus: "archived" })}
                        title="Archive Event"
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Event"
        subtitle="Establish a dedicated financial ledger and settings for a college program"
        maxWidth="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Event Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. TechFest 2026 / Farewell 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief overview of event scope and budget targets"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Default Target Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                value={defaultTargetAmount}
                onChange={(e) => setDefaultTargetAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2.5 cursor-pointer py-2.5 text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={targetAmountEnabled}
                  onChange={(e) => setTargetAmountEnabled(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Enable Target Amount Requirement</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={installmentsEnabled}
                onChange={(e) => setInstallmentsEnabled(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
              />
              <span>Allow Flexible Installments</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(e) => setApprovalRequired(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
              />
              <span>Require Super Coordinator Approval</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md flex items-center gap-2"
            >
              {createLoading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Settings Modal */}
      {editEvent && (
        <Modal
          isOpen={!!editEvent}
          onClose={() => setEditEvent(null)}
          title={`Edit Settings: ${editEvent.name}`}
          maxWidth="lg"
        >
          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Event Name
              </label>
              <input
                type="text"
                required
                value={editEvent.name}
                onChange={(e) => setEditEvent({ ...editEvent, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Default Target (₹)
              </label>
              <input
                type="number"
                min="0"
                value={editEvent.defaultTargetAmount}
                onChange={(e) =>
                  setEditEvent({ ...editEvent, defaultTargetAmount: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={editEvent.targetAmountEnabled}
                  onChange={(e) =>
                    setEditEvent({ ...editEvent, targetAmountEnabled: e.target.checked })
                  }
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                />
                <span>Target Amount Enabled</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={editEvent.installmentsEnabled}
                  onChange={(e) =>
                    setEditEvent({ ...editEvent, installmentsEnabled: e.target.checked })
                  }
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                />
                <span>Installment Mode Enabled</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={editEvent.approvalRequired}
                  onChange={(e) =>
                    setEditEvent({ ...editEvent, approvalRequired: e.target.checked })
                  }
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
                />
                <span>Approval Required for Payments</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditEvent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl"
              >
                Save Settings
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Duplicate Modal */}
      {duplicateTarget && (
        <Modal
          isOpen={!!duplicateTarget}
          onClose={() => setDuplicateTarget(null)}
          title="Duplicate Event Structure"
          subtitle="Copies settings and configuration only. Payments, expenses, receipts, and audit logs are NOT copied."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                New Event Name
              </label>
              <input
                type="text"
                required
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDuplicateTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicateLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2"
              >
                {duplicateLoading ? "Duplicating..." : "Confirm Duplicate"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Status Confirm Dialog */}
      {statusDialogEvent && (
        <ConfirmDialog
          isOpen={!!statusDialogEvent}
          onClose={() => setStatusDialogEvent(null)}
          onConfirm={handleStatusChange}
          title={
            statusDialogEvent.nextStatus === "active"
              ? "Reopen this event?"
              : `Change Status to "${statusDialogEvent.nextStatus.toUpperCase()}"`
          }
          message={
            statusDialogEvent.nextStatus === "active"
              ? "Reopening the event will allow coordinators to resume permitted financial operations. Existing records will not be deleted or reset."
              : `Are you sure you want to change the status of "${statusDialogEvent.event.name}" to ${statusDialogEvent.nextStatus}? When closed or archived, payment collections will be restricted according to coordinator permissions.`
          }
          confirmLabel={
            statusDialogEvent.nextStatus === "active" ? "Reopen Event" : "Update Status"
          }
          variant={statusDialogEvent.nextStatus === "archived" ? "danger" : "warning"}
        />
      )}
    </div>
  );
};
