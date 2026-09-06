// Helpers de texto/formatação — transcritos 1:1 do MercadoDoCasal.html.

import { DIA_MS } from "./constants";

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** `null`/`""`/`NaN` → "—"; senão moeda BRL. */
export function fmt(e: unknown): string {
  if (e === null || e === undefined || e === "" || Number.isNaN(Number(e))) return "—";
  return BRL.format(Number(e));
}

/** `null`/`NaN` → "—"; senão `(100*e).toFixed(1)+"%"`. */
export function fmtPct(e: unknown): string {
  if (e === null || e === undefined || Number.isNaN(Number(e))) return "—";
  return (100 * Number(e)).toFixed(1) + "%";
}

/** YYYY-MM-DD **local** (não UTC). */
export function today(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/** data de compra → dd/mm/aaaa; ancorada ao meio-dia local para evitar bug de fuso. */
export function brDate(e: string): string {
  try {
    return new Date(e + "T12:00:00").toLocaleDateString("pt-BR");
  } catch {
    return e;
  }
}

/** lowercase + sem acento (NFD). Base de toda busca e casamento por nome. */
export function norm(e: unknown): string {
  return (typeof e === "string" ? e : String(e ?? ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** dias desde uma data ISO; `null` sem data, piso 0. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DIA_MS));
}

/** "setembro de 2026" — mês/ano local. */
export function agoraBr(): string {
  return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
