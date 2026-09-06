// ===========================================================================
//  PREVISÃO DE REPOSIÇÃO — helper unificado.
//  Dashboard ("Pode precisar repor") e Calendário ("previsto") compartilham a
//  fórmula-base (média dos intervalos entre compras, com fallback FREQ_DAYS),
//  mas divergem no resto. Spec: ref-spec-dashboard-calendar-schema-backup.md.
// ===========================================================================

import type { Frequency } from "@/db/types";
import { DIA_MS, FREQ_DAYS } from "@/lib/constants";

export interface ForecastInput {
  /** datas de compra do produto (YYYY-MM-DD), como vieram do histórico. */
  datas: string[];
  frequency: Frequency;
}

export interface ForecastOptions {
  /** remover datas repetidas antes de calcular (Calendário: sim; Dashboard: não). */
  dedup?: boolean;
}

export interface ForecastResult {
  /** média de dias entre compras (ou o FREQ_DAYS de fallback). null se não dá pra prever. */
  media: number | null;
  /** última data de compra usada. */
  ultima: string | null;
  /** dias decorridos desde a última compra (piso 0). */
  desde: number | null;
  /** dias até acabar: ceil(media - desde). Negativo = já passou. null se sem previsão. */
  restante: number | null;
  /** data prevista de reposição: última + round(media). null se sem previsão. */
  dataPrevista: Date | null;
  /** quantas compras entraram no cálculo. */
  amostras: number;
}

/**
 * Regra base (idêntica nas duas telas):
 * - precisa de ≥ 2 compras;
 * - com ≥ 2 intervalos (≥ 3 compras) usa a média dos intervalos;
 * - senão, usa FREQ_DAYS[frequency] como fallback;
 * - intervalos ≤ 0 são descartados.
 */
export function forecast(input: ForecastInput, opts: ForecastOptions = {}): ForecastResult {
  const vazio: ForecastResult = {
    media: null,
    ultima: null,
    desde: null,
    restante: null,
    dataPrevista: null,
    amostras: 0,
  };

  let datas = input.datas.slice();
  if (opts.dedup) datas = [...new Set(datas)];
  datas.sort();

  if (datas.length < 2) return { ...vazio, amostras: datas.length };

  const ultima = datas[datas.length - 1];
  const intervalos: number[] = [];
  for (let k = 1; k < datas.length; k++) {
    const dif =
      (new Date(datas[k] + "T12:00:00").getTime() - new Date(datas[k - 1] + "T12:00:00").getTime()) /
      DIA_MS;
    if (dif > 0) intervalos.push(dif);
  }

  const cadastrado = FREQ_DAYS[input.frequency];
  const media =
    intervalos.length >= 2
      ? intervalos.reduce((x, y) => x + y, 0) / intervalos.length
      : cadastrado;

  if (!media) return { ...vazio, ultima, amostras: datas.length };

  const desde = Math.max(
    0,
    Math.floor((Date.now() - new Date(ultima + "T12:00:00").getTime()) / DIA_MS),
  );
  const restante = Math.ceil(media - desde);

  const dataPrevista = new Date(ultima + "T12:00:00");
  dataPrevista.setDate(dataPrevista.getDate() + Math.round(media));

  return { media, ultima, desde, restante, dataPrevista, amostras: datas.length };
}
