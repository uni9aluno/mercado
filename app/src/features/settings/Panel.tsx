import type { ReactNode } from "react";

// Seção de card branco — portado do `Panel` do MercadoDoCasal.html.
// TODO: promover para ui/ se outra tela precisar.
export function Panel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
