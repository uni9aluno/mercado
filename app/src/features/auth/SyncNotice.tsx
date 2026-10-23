import { dispensarAviso } from "@/sync/accountSync";
import { useSyncStatus } from "@/sync/useSyncStatus";
import { Icon } from "@/ui";

/** aviso único (ex.: conflito resolvido com cópia local) — precisa ser lido no celular também. */
export function SyncNotice() {
  const { aviso } = useSyncStatus();
  if (!aviso) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-40 mx-auto flex max-w-md items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg"
    >
      <Icon.alert size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1">{aviso}</p>
      <button
        onClick={dispensarAviso}
        aria-label="Fechar aviso"
        className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-amber-100"
      >
        <Icon.x size={16} />
      </button>
    </div>
  );
}
