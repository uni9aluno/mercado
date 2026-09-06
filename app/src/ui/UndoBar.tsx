import { useSyncExternalStore } from "react";
import { undoRun, undoSnapshot, undoSubscribe } from "@/lib/undo";

export function UndoBar() {
  const snap = useSyncExternalStore(undoSubscribe, undoSnapshot, () => null);
  if (!snap) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg fade-in">
        <span>{snap.label}</span>
        <button
          onClick={() => void undoRun()}
          className="font-semibold text-emerald-300 hover:text-emerald-200"
        >
          Desfazer
        </button>
      </div>
    </div>
  );
}
