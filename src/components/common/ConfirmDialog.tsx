import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle, CheckCircle, Info, Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "success" | "info";
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  loading = false,
}) => {
  const iconMap = {
    danger: <Trash2 className="w-6 h-6 text-rose-400" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-400" />,
    success: <CheckCircle className="w-6 h-6 text-emerald-400" />,
    info: <Info className="w-6 h-6 text-blue-400" />,
  };

  const btnStyleMap = {
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20",
    warning: "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20",
    info: "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-slate-800 rounded-xl shrink-0">
          {iconMap[variant]}
        </div>
        <div className="text-sm text-slate-300 space-y-2 flex-1">
          {typeof message === "string" ? <p>{message}</p> : message}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-2 ${btnStyleMap[variant]} ${
            loading ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
};
