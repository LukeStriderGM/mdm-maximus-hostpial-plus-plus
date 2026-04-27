import { type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-elevated border border-border rounded-lg w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text">{title}</h3>
          <button onClick={onClose} className="text-text-disabled hover:text-text"><X size={16} /></button>
        </div>
        <div className="p-4">{children}</div>
        {actions && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
