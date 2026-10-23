import { useState } from "react";
import { repos } from "@/data";
import type { SharedCatalogSettings } from "@/db/types";
import { useAuth } from "@/features/auth/AuthContext";
import { useSetting } from "@/hooks";
import { publicarPendentes } from "@/sync/publicador";
import { Btn } from "@/ui";
import { Panel } from "./Panel";

/** Preferência de publicação no catálogo de todos. Só com login. */
export function SharedCatalogPanel({ aviso }: { aviso: (m: string) => void }) {
  const auth = useAuth();
  const row = useSetting<SharedCatalogSettings>("sharedCatalog");
  const [publicando, setPublicando] = useState(false);
  if (!auth) return null;
  const publicar = row?.publicar ?? true;

  async function alternar(v: boolean) {
    await repos.settings.put({ key: "sharedCatalog", publicar: v });
    if (v) void publicarPendentes();
  }

  async function publicarAgora() {
    setPublicando(true);
    try {
      const n = await publicarPendentes(true);
      aviso(n ? n + " produto(s) publicado(s) no catálogo de todos." : "Nada novo para publicar.");
    } catch (e) {
      aviso("Não foi possível publicar: " + (e as Error).message);
    } finally {
      setPublicando(false);
    }
  }

  return (
    <Panel title="Catálogo de todos">
      <p className="mb-3 text-xs text-gray-500">
        Um catálogo de produtos comum a todos os usuários do app, aberto em Produtos → “Catálogo”.
        Só vão nome, marca, categoria, embalagem, frequência e código de barras: nunca preços,
        mercados, fotos ou histórico. Suas listas e compras continuam só suas.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          checked={publicar}
          onChange={(e) => void alternar(e.target.checked)}
        />
        Publicar meus produtos automaticamente
      </label>
      <Btn variant="secondary" onClick={publicarAgora} disabled={publicando}>
        {publicando ? "Publicando…" : "Publicar meus produtos agora"}
      </Btn>
    </Panel>
  );
}
