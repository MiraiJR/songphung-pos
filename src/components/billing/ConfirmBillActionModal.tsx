import type { ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  confirmText: string;
  cancelText?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  leftContent: ReactNode;
  rightContent: ReactNode;
};

export function ConfirmBillActionModal({
  open,
  title,
  confirmText,
  cancelText = "Hủy",
  busy = false,
  onClose,
  onConfirm,
  leftContent,
  rightContent,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]">
      <div className="relative flex max-h-[92vh] w-[980px] max-w-[97vw] flex-col rounded-lg bg-white shadow-lg">
        <button
          type="button"
          className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          disabled={busy}
          onClick={onClose}
          aria-label="Đóng"
        >
          <X size={18} />
        </button>
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-5 lg:grid-cols-[1fr_320px]">
          <div className="min-h-0 overflow-y-auto pr-1">{leftContent}</div>
          {rightContent}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button className="btn-ghost" disabled={busy} onClick={onClose}>
            {cancelText}
          </button>
          <button className="btn-secondary" disabled={busy} onClick={onConfirm}>
            {busy ? "Đang xử lý..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
