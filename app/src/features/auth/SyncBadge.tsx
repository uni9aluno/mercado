import { rotuloSync } from "@/sync/rotuloSync";
import { useSyncStatus } from "@/sync/useSyncStatus";

export function SyncBadge({ email }: { email: string }) {
  const s = useSyncStatus();
  const { texto, cor } = rotuloSync(s);
  return (
    <div className="mb-2 px-3 text-xs text-gray-500" title={s.erro ?? texto}>
      <div className="truncate">{email}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className={"inline-block h-2 w-2 rounded-full " + cor} aria-hidden />
        {texto}
      </div>
    </div>
  );
}
