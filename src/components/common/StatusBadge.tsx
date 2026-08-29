import React from "react";
import type { PaymentStatus, ParticipationStatus, StudentPaymentStatus } from "../../types";

type AnyStatus =
  | PaymentStatus
  | ParticipationStatus
  | StudentPaymentStatus
  | "active"
  | "closed"
  | "archived"
  | "reversed"
  | "reconciled"
  | "under_received"
  | "over_received";

interface StatusBadgeProps {
  status: AnyStatus | string;
  size?: "sm" | "md";
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  // Payment Statuses
  approved: {
    label: "Approved",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  pending_approval: {
    label: "Pending Approval",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  declined: {
    label: "Declined",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
  rolled_back: {
    label: "Rolled Back",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },

  // Student Payment State
  fully_paid: {
    label: "Fully Paid",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  partially_paid: {
    label: "Partially Paid",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  not_paid: {
    label: "Not Paid",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
  exempted: {
    label: "Exempted",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  waived: {
    label: "Coordinator Waived",
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    border: "border-teal-500/20",
  },

  // Event / Assignment State
  active: {
    label: "Active",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  closed: {
    label: "Closed",
    bg: "bg-slate-800",
    text: "text-slate-400",
    border: "border-slate-700",
  },
  archived: {
    label: "Archived",
    bg: "bg-rose-950/40",
    text: "text-rose-400",
    border: "border-rose-900/40",
  },
  reversed: {
    label: "Reversed",
    bg: "bg-slate-800",
    text: "text-slate-400",
    border: "border-slate-700",
  },

  // Reconciliation State
  reconciled: {
    label: "Reconciled",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  under_received: {
    label: "Under-received",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
  over_received: {
    label: "Over-received",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const config = statusConfig[status] || {
    label: status.replace(/_/g, " "),
    bg: "bg-slate-800",
    text: "text-slate-300",
    border: "border-slate-700",
  };

  const sizeStyles = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeStyles}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 shrink-0 opacity-80" />
      <span>{config.label}</span>
    </span>
  );
};
