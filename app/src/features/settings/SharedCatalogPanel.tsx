import { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { publicarPendentes } from "@/sync/publicador";
import { Btn } from "@/ui";
import { Panel } from "./Panel";

/** Catálogo de todos: explica o que é publicado e permite publicar agora. Só com login. */
export function SharedCatalogPanel({ aviso }: { aviso: (m: string) => void }) {
  const auth = useAuth();
  const [publicando, setPublicando] = useState(false);
  if (!auth) return null;

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
        Todo produto cadastrado por qualquer usuário fica visível para todos em Produtos →
        “Catálogo”, com nome, marca, categoria, embalagem, frequência, código de barras e foto.
        Preços, mercados, listas, compras e histórico continuam só seus.
      </p>
      <p className="mb-3 text-xs text-amber-700">
        Ao tirar a foto de um produto, enquadre só a embalagem: ela será vista por todos.
      </p>
      <Btn variant="secondary" onClick={publicarAgora} disabled={publicando}>
        {publicando ? "Publicando…" : "Publicar meus produtos agora"}
      </Btn>
    </Panel>
  );
}
