// Ícone local da tela Comparador — `up` (compartilhar / enviar) não existe em
// `@/ui/icons`. Transcrito 1:1 do conjunto `I` do MercadoDoCasal.html
// (`up:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12"`).
// TODO: promover para ui/ quando outra tela precisar.

interface P {
  size?: number;
  className?: string;
}

export function Share({ size = 20, className }: P) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}
