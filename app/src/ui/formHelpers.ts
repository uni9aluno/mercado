import type { FocusEvent } from "react";

export const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";

/** seleciona o conteúdo de um <input type=number> ao focar. */
export function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  if (e.target.type === "number") e.target.select();
}
