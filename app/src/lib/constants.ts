import type { Buyer, Frequency, PackageUnit, Priority } from "@/db/types";

// Transcrito 1:1 do MercadoDoCasal.html (linha 361).

export const PAYMENT_METHODS = [
  "VR / VA",
  "Cartão de Débito",
  "Cartão de Crédito",
  "PIX",
  "Dinheiro",
] as const;

export const PURCHASE_TYPES = ["Essencial", "Planejada", "Promoção", "Impulso"] as const;

export const BUYERS: { value: Buyer; label: string }[] = [
  { value: "ele", label: "Ele" },
  { value: "ela", label: "Ela" },
  { value: "juntos", label: "Juntos" },
];

/** rótulo do comprador para exibição (Calendário, detalhe de compra). */
export const BUYER_LABEL: Record<Buyer, string> = {
  ele: "Ele",
  ela: "Ela",
  juntos: "Juntos",
};

export const RATING_LABEL: Record<string, string> = {
  ok: "Tranquilo",
  lotado: "Lotado",
  faltou: "Faltou produto",
  preco_ruim: "Preço ruim",
};

export const FREQUENCIES: Frequency[] = ["Semanal", "15 dias", "30 dias", "60 dias"];

export const PRIORITIES: Priority[] = ["Alta", "Média", "Baixa"];

export const UNITS = [
  "kg",
  "un",
  "pacote",
  "garrafa",
  "lata",
  "litro",
  "pote",
  "barra",
  "frasco",
  "caixa",
  "cartela",
  "dúzia",
  "maço",
  "pé",
] as const;

export const PKG_UNITS: PackageUnit[] = ["ml", "L", "g", "kg", "un", "pç"];

export const FREQ_DAYS: Record<Frequency, number> = {
  Semanal: 7,
  "15 dias": 15,
  "30 dias": 30,
  "60 dias": 60,
};

/** ms em um dia — `864e5` no código original. */
export const DIA_MS = 86_400_000;

/** janela de 90 dias usada no motor de preços e no Comparador. */
export const JANELA_90 = 90 * DIA_MS;

export const CALENDAR_COLORS = [
  "#059669",
  "#2563eb",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be123c",
] as const;

/** cor da previsão no calendário (laranja, borda tracejada). */
export const COR_PREVISAO = "#f97316";
