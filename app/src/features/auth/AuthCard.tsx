import type { ReactNode } from "react";

/** moldura comum das telas sem sessão (login, nova senha, erro de carga). */
export function AuthCard({ subtitulo, children }: { subtitulo?: string; children: ReactNode }) {
  return (
    <div className="safe-screen-x flex min-h-full items-center justify-center py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl" aria-hidden>
            🛒
          </div>
          <h1 className="mt-2 text-xl font-bold text-emerald-700">Mercado do Casal</h1>
          {subtitulo && <p className="mt-1 text-sm text-gray-500">{subtitulo}</p>}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export function Aviso({ tom, children }: { tom: "erro" | "ok"; children: ReactNode }) {
  return (
    <p
      role={tom === "erro" ? "alert" : "status"}
      className={
        "mb-3 rounded-lg px-3 py-2 text-sm " +
        (tom === "erro" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800")
      }
    >
      {children}
    </p>
  );
}
