// Ícones locais da tela Histórico — `funil` (filtro) e `chevron` (seta ▼) não
// existem em `@/ui/icons`. Transcritos 1:1 do conjunto `I` do MercadoDoCasal.html
// (`funil:"M3 4h18l-7 8v6l-4 2v-8z"`, `chev:"M6 9l6 6 6-6"`).
// TODO: promover para ui/ quando outra tela precisar.

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

export const Funnel = svg("M3 4h18l-7 8v6l-4 2v-8z");
export const Chevron = svg("M6 9l6 6 6-6");
