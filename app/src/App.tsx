import { useEffect, useState } from "react";
import { db } from "@/db/schema";
import { ensureListForOrphans, seedIfEmpty } from "@/db/seed";
import { MOBILE_TABS, ROUTES } from "./routes";
import { Boundary, Icon, Modal, UndoBar } from "@/ui";

export default function App() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tab, setTab] = useState("dashboard");
  const [maisAberto, setMaisAberto] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await db.open();
        await seedIfEmpty();
        await ensureListForOrphans();
        setPronto(true);
      } catch (e) {
        setErro(String(e));
      }
    })();
  }, []);

  if (erro) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-red-700">
        <p className="mb-2 font-semibold">Não foi possível abrir o banco de dados.</p>
        <p className="text-red-600">{erro}</p>
      </div>
    );
  }

  if (!pronto) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-400">
        <div className="animate-pulse text-center">
          <div className="text-4xl">🛒</div>
          <p className="mt-2 text-sm">Carregando…</p>
        </div>
      </div>
    );
  }

  const atual = ROUTES.find((r) => r.id === tab) ?? ROUTES[0];
  const Tela = atual.Component;
  const mobileRoutes = ROUTES.filter((r) => MOBILE_TABS.includes(r.id));
  const maisRoutes = ROUTES.filter((r) => !MOBILE_TABS.includes(r.id));

  const ir = (id: string) => {
    setTab(id);
    setMaisAberto(false);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-5xl md:gap-4 md:p-4">
      {/* nav lateral — desktop */}
      <nav className="sticky top-4 hidden h-fit w-48 shrink-0 flex-col gap-1 md:flex">
        <div className="mb-2 px-3 text-lg font-bold text-emerald-700">Mercado do Casal</div>
        {ROUTES.map((r) => {
          const Ico = Icon[r.icon];
          const on = r.id === tab;
          return (
            <button
              key={r.id}
              onClick={() => ir(r.id)}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                (on ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-100")
              }
            >
              <Ico size={18} />
              {r.label}
            </button>
          );
        })}
      </nav>

      {/* conteúdo */}
      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        <Boundary>
          <Tela />
        </Boundary>
      </main>

      {/* bottom bar — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white md:hidden">
        {mobileRoutes.map((r) => {
          const Ico = Icon[r.icon];
          const on = r.id === tab;
          return (
            <button
              key={r.id}
              onClick={() => ir(r.id)}
              className={
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] " +
                (on ? "text-emerald-700" : "text-gray-400")
              }
            >
              <Ico size={20} />
              {r.label}
            </button>
          );
        })}
        <button
          onClick={() => setMaisAberto(true)}
          className={
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] " +
            (maisRoutes.some((r) => r.id === tab) ? "text-emerald-700" : "text-gray-400")
          }
        >
          <Icon.more size={20} />
          Mais
        </button>
      </nav>

      <Modal open={maisAberto} onClose={() => setMaisAberto(false)} title="Mais">
        <div className="grid grid-cols-2 gap-2">
          {maisRoutes.map((r) => {
            const Ico = Icon[r.icon];
            return (
              <button
                key={r.id}
                onClick={() => ir(r.id)}
                className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 p-4 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Ico size={22} />
                {r.label}
              </button>
            );
          })}
        </div>
      </Modal>

      <UndoBar />
    </div>
  );
}
