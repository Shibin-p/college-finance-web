import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return <div className={`bg-slate-800/60 rounded-xl animate-pulse ${className}`} />;
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`row-${r}`} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`cell-${r}-${c}`} className="h-12 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};
