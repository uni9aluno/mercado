// Leitor de código de barras + consulta/vínculo de EAN.
// Consumido por Produtos, Lista, Registrar e o ProductForm.

export { BarcodeScanner } from "./BarcodeScanner";
export { BarcodeLookup, type BarcodePrefill } from "./BarcodeLookup";
export { AvisoCamera } from "./AvisoCamera";
export { canScanBarcode, hasCamStream, hasQuagga, motivoSemCamera } from "./camera";
