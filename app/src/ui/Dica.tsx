import { useState, type ReactNode } from "react";

// Bloco de ajuda por tela. Estado aberto/fechado em localStorage (mdc.dica.<id>) —
// preferência de interface, deliberadamente FORA do backup e do settings.

interface Props {
  id: string;
  itens: ReactNode[];
  cls?: string;
}

export function Dica({ id, itens, cls = "mb-3" }: Props) {
  const chave = "mdc.dica." + id;
  const [aberta, setAberta] = useState(() => {
    try {
      return localStorage.getItem(chave) !== "0";
    } catch {
      return true;
    }
  });

  const alternar = () => {
    const nova = !aberta;
    setAberta(nova);
    try {
      localStorage.setItem(chave, nova ? "1" : "0");
    } catch {
      /* modo privado — sem persistência, tudo bem */
    }
  };

  return (
    <div className={"rounded-xl bg-blue-50 " + cls}>
      <button
        onClick={alternar}
        aria-expanded={aberta}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-blue-700"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={"transition-transform " + (aberta ? "rotate-90" : "")}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        Como usar esta tela
      </button>
      {aberta && (
        <ul className="list-disc space-y-1 px-8 pb-3 text-sm text-blue-800">
          {itens.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
