// Faixa âmbar exibida NO LUGAR do botão de escanear quando a leitura por
// câmera não está disponível mas há uma explicação a dar. Portado 1:1 de
// MercadoDoCasal.html — textos exatos.

import { motivoSemCamera } from "./camera";

export function AvisoCamera() {
  const m = motivoSemCamera();
  if (!m) return null;
  return (
    <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
      <div className="mb-1 font-medium">Leitura por câmera indisponível aqui</div>
      {m}
    </div>
  );
}
