// Sparkline SVG do histórico de preços. Portado 1:1 da spec
// (ref-spec-motor-precos-e-comparador.md, PARTE 2 > PriceSpark).

import { useState } from "react";
import { brDate, fmt } from "@/lib/text";
import type { PontoSerie } from "@/domain/compare";
import type { Store } from "@/db/types";

const LG = 320;
const AL = 160;
const PD = 18;
const CORES = ["#059669", "#2563eb", "#9333ea", "#ea580c"];

interface Props {
  serie: PontoSerie[];
  storeById: Map<string, Store>;
}

export function PriceSpark({ serie, storeById }: Props) {
  const [tip, setTip] = useState<{ x: number; y: number; txt: string } | null>(null);

  if (serie.length < 2) return null;

  const precos = serie.map((p) => p.price);
  const mn = Math.min(...precos) * 0.95;
  const mx = Math.max(...precos) * 1.05;
  const rng = mx - mn || 1;

  const px = (ix: number) => PD + (ix * (LG - 2 * PD)) / (serie.length - 1);
  const py = (v: number) => AL - PD - ((v - mn) / rng) * (AL - 2 * PD);

  // grupos por loja, preservando a ordem em que aparecem
  const ordem: (string | null)[] = [];
  for (const p of serie) {
    const k = p.storeId;
    if (!ordem.includes(k)) ordem.push(k);
  }

  const nomeLoja = (sid: string | null) =>
    sid == null ? "Sem mercado" : (storeById.get(sid)?.name ?? "—");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${LG} ${AL}`} className="w-full">
        {ordem.map((sid, li) => {
          const pontos = serie
            .map((p, ix) => ({ p, ix }))
            .filter(({ p }) => p.storeId === sid);
          const cor = CORES[li % 4];
          const d = pontos.map(({ p, ix }) => `${px(ix)},${py(p.price)}`).join(" ");
          const impar = li % 2 === 1;
          return (
            <g key={String(sid)}>
              <polyline
                points={d}
                fill="none"
                stroke={cor}
                strokeWidth={2}
                strokeDasharray={impar ? "5 3" : undefined}
              />
              {pontos.map(({ p, ix }) =>
                impar ? (
                  <rect
                    key={ix}
                    x={px(ix) - 3.5}
                    y={py(p.price) - 3.5}
                    width={7}
                    height={7}
                    fill={cor}
                  />
                ) : (
                  <circle key={ix} cx={px(ix)} cy={py(p.price)} r={3.5} fill={cor} />
                ),
              )}
            </g>
          );
        })}
        {/* alvos de clique */}
        {serie.map((p, ix) => (
          <circle
            key={ix}
            cx={px(ix)}
            cy={py(p.price)}
            r={8}
            fill="transparent"
            onMouseEnter={() =>
              setTip({
                x: px(ix),
                y: py(p.price),
                txt: `${brDate(p.date)} · ${nomeLoja(p.storeId)} · ${fmt(p.price)}`,
              })
            }
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded bg-gray-900 px-2 py-1 text-xs text-white"
          style={{ left: `${(tip.x / LG) * 100}%`, top: `${(tip.y / AL) * 100}%` }}
        >
          {tip.txt}
        </div>
      )}
    </div>
  );
}
