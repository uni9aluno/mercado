// Miniatura do produto: <img> quando há foto (data URI), senão um círculo com a
// inicial. Usada na Lista, no BuyMode, na tela Produtos e no ProductForm.

interface Props {
  src?: string | null;
  nome: string;
  /** lado em px. */
  size?: number;
}

const CORES = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function corDe(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
}

export function Thumb({ src, nome, size = 40 }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={nome}
        width={size}
        height={size}
        className="shrink-0 rounded-lg object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const inicial = (nome.trim()[0] || "?").toUpperCase();
  return (
    <div
      className={"flex shrink-0 items-center justify-center rounded-lg font-semibold " + corDe(nome)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {inicial}
    </div>
  );
}
