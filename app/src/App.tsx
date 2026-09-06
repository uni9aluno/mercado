import { useEffect, useState } from "react";
import { db } from "@/db/schema";
import { ensureListForOrphans, seedIfEmpty } from "@/db/seed";

// Fase 0-3 — andaime. Vira o roteador de verdade na Fase 4.
export default function App() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [contagem, setContagem] = useState<{ produtos: number; listas: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await db.open();
        await seedIfEmpty();
        await ensureListForOrphans();
        setContagem({
          produtos: await db.products.count(),
          listas: await db.shoppingLists.count(),
        });
        setPronto(true);
      } catch (e) {
        setErro(String(e));
      }
    })();
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">🛒</div>
      <h1 className="text-2xl font-bold text-emerald-700">Mercado do Casal</h1>
      <p className="text-slate-600">
        Reescrita em Vite + React + TypeScript. O banco (schema v{db.verno}) abriu e o seed rodou.
      </p>
      {erro && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</div>
      )}
      {pronto && contagem && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {contagem.produtos} produtos · {contagem.listas} lista(s)
        </div>
      )}
      <p className="text-xs text-slate-400">Andaime · telas a partir da Fase 4</p>
    </div>
  );
}
