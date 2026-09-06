import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, wide }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div
        className={
          "relative max-h-[88vh] w-full overflow-auto rounded-t-2xl bg-white shadow-2xl fade-in md:rounded-2xl " +
          (wide ? "md:max-w-2xl" : "md:max-w-md")
        }
      >
        {title != null && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
