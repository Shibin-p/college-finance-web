import React from "react";
import { formatINR } from "../../utils/formatters";

interface MoneyDisplayProps {
  amount: number | undefined | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  variant?: "default" | "emerald" | "amber" | "rose" | "slate";
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  amount,
  className = "",
  size = "md",
  variant = "default",
}) => {
  const sizeClasses = {
    sm: "text-xs font-semibold",
    md: "text-sm font-bold",
    lg: "text-base font-extrabold",
    xl: "text-xl font-black",
    "2xl": "text-2xl sm:text-3xl font-black tracking-tight",
  };

  const variantClasses = {
    default: "text-slate-100",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    slate: "text-slate-400",
  };

  return (
    <span className={`font-mono ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {formatINR(amount)}
    </span>
  );
};
