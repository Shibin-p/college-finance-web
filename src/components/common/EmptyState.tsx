import React from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto animate-fade-in">
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 text-slate-400 mb-4 shadow-xl">
        <Icon className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-base font-bold text-slate-100 tracking-tight">{title}</h3>
      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
