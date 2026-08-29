import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-4 px-4 border-t border-slate-800/80 bg-slate-950/60 text-center text-xs text-slate-500">
      <div className="flex flex-col items-center justify-center max-w-7xl mx-auto space-y-1">
        <p className="font-medium text-slate-400 text-xs">
          © 2026 EKCTC Finance. All rights reserved.
        </p>
        <p className="text-slate-500 text-[11px] font-medium tracking-wide">
          Powered by{" "}
          <span className="font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
            Zicago
          </span>
        </p>
      </div>
    </footer>
  );
};
