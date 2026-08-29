import React from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "emerald" | "blue" | "amber" | "rose" | "purple" | "slate";
  trend?: string;
  loading?: boolean;
  onClick?: () => void;
}

const colorMap = {
  emerald: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    accent: "text-emerald-400",
  },
  blue: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    border: "border-blue-500/20 hover:border-blue-500/40",
    accent: "text-blue-400",
  },
  amber: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    border: "border-amber-500/20 hover:border-amber-500/40",
    accent: "text-amber-400",
  },
  rose: {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    border: "border-rose-500/20 hover:border-rose-500/40",
    accent: "text-rose-400",
  },
  purple: {
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    border: "border-purple-500/20 hover:border-purple-500/40",
    accent: "text-purple-400",
  },
  slate: {
    badge: "bg-slate-800 text-slate-300 border-slate-700",
    border: "border-slate-800 hover:border-slate-700",
    accent: "text-slate-200",
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "emerald",
  trend,
  loading = false,
  onClick,
}) => {
  const styles = colorMap[variant] || colorMap.emerald;

  return (
    <div
      onClick={onClick}
      className={`glass-panel p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
        styles.border
      } ${onClick ? "cursor-pointer active:scale-98" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-slate-800 rounded animate-pulse mt-2" />
          ) : (
            <h3 className="text-2xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {value}
            </h3>
          )}
          {subtitle && (
            <p className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1.5">
              {trend && (
                <span className={`font-bold ${styles.accent}`}>
                  {trend}
                </span>
              )}
              <span>{subtitle}</span>
            </p>
          )}
        </div>

        <div className={`p-3 rounded-xl border ${styles.badge} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
