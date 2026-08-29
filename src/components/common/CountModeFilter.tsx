import React from "react";
import type { CountMode } from "../../types";

interface CountModeFilterProps {
  value: CountMode;
  onChange: (mode: CountMode) => void;
  counts?: Partial<Record<CountMode, number>>;
}

const MODES: Array<{ id: CountMode; label: string; tooltip: string }> = [
  { id: "fully_paid", label: "Fully Paid", tooltip: "Students who have completely settled their required contribution." },
  { id: "paid_any", label: "Paid Any Amount", tooltip: "Students with at least one payment recorded (including partial)." },
  { id: "partially_paid", label: "Partially Paid", tooltip: "Students who paid something, but still have a balance due." },
  { id: "pending", label: "Pending", tooltip: "Students with remaining balance due (partially paid + unpaid)." },
  { id: "not_paid", label: "Not Paid", tooltip: "Eligible students who have not contributed anything yet." },
  { id: "settled", label: "Settled", tooltip: "Students who are fully paid OR approved for exemption." },
];

export const CountModeFilter: React.FC<CountModeFilterProps> = ({
  value,
  onChange,
  counts = {},
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
      {MODES.map((mode) => {
        const isSelected = value === mode.id;
        const count = counts[mode.id];

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            title={mode.tooltip}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
              isSelected
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>{mode.label}</span>
            {count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                  isSelected
                    ? "bg-emerald-500/30 text-emerald-200"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
