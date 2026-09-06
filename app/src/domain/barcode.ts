// Normalização e validação de código de barras (EAN/GTIN). Portado 1:1 do
// MercadoDoCasal.html. A validação é INDICATIVA — o dígito verificador GTIN
// 8/12/13/14 confere, mas "não encontrado" no catálogo local não significa
// "código inválido".

/** só dígitos, no máximo 14 (comprimento GTIN-14). */
export function normalizarCodigo(v: unknown): string {
  return String(v ?? "")
    .replace(/\D/g, "")
    .slice(0, 14);
}

/**
 * Dígito verificador GTIN. Aceita comprimentos 8, 12, 13 e 14.
 * Soma ponderada dos dígitos de dados, da direita para a esquerda: o mais à
 * direita tem peso 3, depois alterna 1,3,1,3… O verificador é (10 - soma%10) % 10.
 */
export function gtinValido(code: string): boolean {
  const t = normalizarCodigo(code);
  if (![8, 12, 13, 14].includes(t.length)) return false;
  let soma = 0;
  let n = 0;
  for (let r = t.length - 2; r >= 0; r--, n++) {
    soma += Number(t[r]) * (n % 2 ? 1 : 3);
  }
  return (10 - (soma % 10)) % 10 === Number(t[t.length - 1]);
}
