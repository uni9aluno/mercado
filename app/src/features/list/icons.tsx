// Ícones locais da tela Lista — `pin` (alfinete), `funil` (filtro) e `chev`
// (seta) não existem em `@/ui/icons`. Transcritos 1:1 do conjunto `I` do
// MercadoDoCasal.html:
//   pin:  "M9 3h6a2 2 0 012 2v8l2 2H5l2-2V5a2 2 0 012-2z M12 17v4"
//   funil:"M3 4h18l-7 8v6l-4 2v-8z"
//   chev: "M6 9l6 6 6-6"
// TODO: promover para ui/ quando outra tela precisar (Histórico já tem cópias
// de `funil`/`chev` em features/history/icons.tsx).

interface P {
  size?: number;
  className?: string;
}

function svg(path: string) {
  return function IconLocal({ size = 20, className }: P) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d={path} />
      </svg>
    );
  };
}

export const Pin = svg("M9 3h6a2 2 0 012 2v8l2 2H5l2-2V5a2 2 0 012-2z M12 17v4");
export const Funnel = svg("M3 4h18l-7 8v6l-4 2v-8z");
export const Chevron = svg("M6 9l6 6 6-6");
