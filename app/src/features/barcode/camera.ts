// Helpers de disponibilidade da câmera / leitor de código de barras.
// Portado de MercadoDoCasal.html (linha 361). Textos EXATOS do original.
//
// Diferença do original: o Quagga NÃO está mais inline — é a dependência
// `@ericblade/quagga2`, carregada por import dinâmico só quando a câmera é
// usada e não há `BarcodeDetector` nativo. Por isso `hasQuagga()` aqui é
// "consigo importar o bundle", não "o global existe".

/** `getUserMedia` só existe em contexto seguro (HTTPS ou localhost). */
export function hasCamStream(): boolean {
  return !!(
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/**
 * No projeto Vite o fallback Quagga é sempre "carregável" — é um pacote npm,
 * baixado sob demanda. Só um ambiente sem `import()` dinâmico (nenhum navegador
 * moderno) faria isto ser `false`.
 */
export function hasQuagga(): boolean {
  return typeof (globalThis as { fetch?: unknown }).fetch === "function";
}

/**
 * Dá para escanear? Precisa de stream de câmera E de um decodificador —
 * `BarcodeDetector` nativo ou o Quagga (que aqui sempre pode ser importado).
 * Na prática, resume-se a `hasCamStream()`.
 */
export function canScanBarcode(): boolean {
  return hasCamStream() && ("BarcodeDetector" in window || hasQuagga());
}

/**
 * Quando NÃO dá para escanear, a explicação a mostrar no lugar do botão.
 * String vazia quando a câmera está disponível.
 */
export function motivoSemCamera(): string {
  if (hasCamStream()) return "";
  return location.protocol === "file:"
    ? "A câmera precisa que o app seja aberto por um endereço https:// ou instalado como aplicativo. Do arquivo direto, use a digitação do código."
    : "O navegador não liberou a câmera aqui. Abra o app por https:// (ou localhost) para escanear; a digitação do código continua funcionando.";
}
