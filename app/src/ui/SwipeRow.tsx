import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Linha com ações reveladas por swipe. Portado de MercadoDoCasal.html (SwipeRow).
// Deslizar para a esquerda revela "Comprado" e "Excluir".

const LIMITE = 140; // largura total das ações reveladas
const GATILHO = 70; // deslize mínimo para "assumir" a ação ao soltar

interface Props {
  feito?: boolean;
  onComprado?: () => void;
  onExcluir?: () => void;
  children: ReactNode;
}

function ehControle(alvo: EventTarget | null): boolean {
  try {
    const el = alvo as HTMLElement | null;
    return !!el?.closest?.("input,button,select,textarea,a");
  } catch {
    return false;
  }
}

export function SwipeRow({ feito, onComprado, onExcluir, children }: Props) {
  const [desl, setDesl] = useState(0);
  const [suave, setSuave] = useState(true);
  const gesto = useRef<{ x0: number; y0: number; eixo: 0 | 1 | 2; base: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const recolher = useCallback(() => {
    setSuave(true);
    setDesl(0);
  }, []);

  // clicar fora recolhe
  useEffect(() => {
    if (desl === 0) return;
    const fora = (ev: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(ev.target as Node)) recolher();
    };
    document.addEventListener("pointerdown", fora, true);
    return () => document.removeEventListener("pointerdown", fora, true);
  }, [desl, recolher]);

  const comecar = (ev: React.PointerEvent) => {
    if (ehControle(ev.target)) {
      gesto.current = null;
      return;
    }
    gesto.current = { x0: ev.clientX, y0: ev.clientY, eixo: 0, base: desl };
    setSuave(false);
  };

  const mover = (ev: React.PointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const dx = ev.clientX - g.x0;
    const dy = ev.clientY - g.y0;
    if (g.eixo === 0) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.eixo = Math.abs(dx) > Math.abs(dy) ? 1 : 2;
    }
    if (g.eixo !== 1) return;
    let novo = g.base + dx;
    novo = Math.max(-LIMITE, Math.min(0, novo));
    setDesl(novo);
  };

  const soltar = () => {
    const g = gesto.current;
    gesto.current = null;
    setSuave(true);
    if (!g || g.eixo !== 1) return;
    setDesl(desl <= -GATILHO ? -LIMITE : 0);
  };

  return (
    <div ref={caixa} className="relative overflow-hidden">
      {/* ações atrás */}
      <div className="absolute inset-y-0 right-0 flex">
        {onComprado && (
          <button
            onClick={() => {
              recolher();
              onComprado();
            }}
            className="flex w-[70px] items-center justify-center bg-emerald-600 text-xs font-medium text-white"
          >
            {feito ? "Desfazer" : "Comprei"}
          </button>
        )}
        {onExcluir && (
          <button
            onClick={() => {
              recolher();
              onExcluir();
            }}
            className="flex w-[70px] items-center justify-center bg-red-600 text-xs font-medium text-white"
          >
            Excluir
          </button>
        )}
      </div>
      {/* conteúdo por cima */}
      <div
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        className={"relative bg-white " + (suave ? "transition-transform" : "")}
        style={{ transform: `translateX(${desl}px)`, touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
}
