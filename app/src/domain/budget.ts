// ===========================================================================
//  ORÇAMENTO — barras por forma de pagamento e alerta de vencimento VR/VA.
//  Spec: ref-spec-dashboard-calendar-schema-backup.md (DASHBOARD > Alertas 4;
//  Layout 5). Código puro.
// ===========================================================================

import { DIA_MS } from "@/lib/constants";

/** cor da barra: verde ≤ 70%, amarelo (70%, 90%], vermelho > 90%. */
export function corBarra(fracao: number): string {
  return fracao > 0.9 ? "bg-red-500" : fracao > 0.7 ? "bg-amber-500" : "bg-emerald-500";
}

export interface LinhaOrcamento {
  label: string;
  valor: number;
  limite: number;
  fracao: number;
  cor: string;
  larguraPct: number;
}

/**
 * Duas linhas fixas: VR/VA e "Dinheiro e outros".
 * `gastoVrva` = soma do mês em "VR / VA"; `gastoOutros` = resto do mês.
 */
export function linhasOrcamento(
  gastoVrva: number,
  gastoOutros: number,
  budget: { vrva: number; extra: number },
): LinhaOrcamento[] {
  const mk = (label: string, valor: number, limite: number): LinhaOrcamento => {
    const fracao = limite ? valor / limite : 0;
    return {
      label,
      valor,
      limite,
      fracao,
      cor: corBarra(fracao),
      larguraPct: Math.min(100, 100 * fracao),
    };
  };
  return [
    mk("VR/VA", gastoVrva, budget.vrva),
    mk("Dinheiro e outros", gastoOutros, budget.extra),
  ];
}

export interface AlertaVrva {
  diaVenc: number;
  faltamDias: number;
  restante: number;
}

/**
 * Alerta de vencimento do VR/VA. Retorna null quando não se aplica.
 * Condições (todas): 0 ≤ faltamVenc ≤ 5, budget.vrva > 0, e o gasto VR/VA do
 * mês ainda está abaixo de 70% do limite.
 */
export function alertaVencimentoVrva(
  agora: Date,
  gastoVrva: number,
  budgetVrva: number,
  vrvaExpiryDay: number | undefined,
): AlertaVrva | null {
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const diaVenc = Math.min(ultimoDia, Math.max(1, Number(vrvaExpiryDay) || 30));
  const faltamDias = Math.ceil(
    (new Date(ano, mes, diaVenc, 23, 59, 59).getTime() - agora.getTime()) / DIA_MS,
  );
  if (faltamDias >= 0 && faltamDias <= 5 && budgetVrva > 0 && gastoVrva < 0.7 * budgetVrva) {
    return { diaVenc, faltamDias, restante: budgetVrva - gastoVrva };
  }
  return null;
}
