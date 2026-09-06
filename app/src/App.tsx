import { useEffect, useState } from "react";

// Fase 0 — andaime. Esta tela só existe para provar o pipeline Vite -> Actions -> Pages.
// Nas fases seguintes o App.tsx vira o roteador de verdade (troca de aba, nav mobile/desktop).
export default function App() {
  const [dexieOk, setDexieOk] = useState<string>("checando…");

  useEffect(() => {
    // Toca o Dexie para confirmar que a dependência resolve no build.
    import("dexie")
      .then(({ default: Dexie }) => setDexieOk(`Dexie ${Dexie.semVer} carregado`))
      .catch((e) => setDexieOk(`falha: ${String(e)}`));
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">🛒</div>
      <h1 className="text-2xl font-bold text-emerald-700">Mercado do Casal</h1>
      <p className="text-slate-600">
        Andaime da reescrita em Vite + React + TypeScript. Se você está vendo isto publicado, o
        pipeline de build e deploy está funcionando.
      </p>
      <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{dexieOk}</div>
      <p className="text-xs text-slate-400">Fase 0 · {new Date().toISOString().slice(0, 10)}</p>
    </div>
  );
}
