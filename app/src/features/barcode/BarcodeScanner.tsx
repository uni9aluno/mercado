// ===========================================================================
//  BarcodeScanner — leitor de código de barras pela câmera.
//  Portado 1:1 de MercadoDoCasal.html (linha 361).
//
//  Portal para document.body, tela cheia preta. Tenta `BarcodeDetector` nativo
//  primeiro (mais leve); sem ele, cai para `@ericblade/quagga2` carregado por
//  IMPORT DINÂMICO dentro do effect (o bundle tem ~156 KB e só deve baixar
//  quando de fato é preciso).
//
//  A câmera só funciona em contexto seguro (HTTPS ou localhost) — em `file://`
//  `hasCamStream()` é sempre `false` e a mensagem explica.
// ===========================================================================

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hasCamStream, hasQuagga, motivoSemCamera } from "./camera";

/**
 * `BarcodeDetector` ainda não está no lib.dom padrão do TS. Declaração mínima
 * do que este componente usa. Portado do uso no original.
 */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
}

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const nativo = "BarcodeDetector" in window;
  const [msg, setMsg] = useState(
    nativo ? "Aponte a câmera para o código de barras" : "Preparando a câmera…",
  );

  useEffect(() => {
    if (!hasCamStream()) {
      setMsg(motivoSemCamera());
      return;
    }

    let vivo = true;
    let stream: MediaStream | null = null;
    let raf = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let quaggaAtivo = false;
    // O módulo Quagga só é carregado se o fallback for usado.
    type QuaggaMod = typeof import("@ericblade/quagga2")["default"];
    let Quagga: QuaggaMod | null = null;
    type QuaggaCb = Parameters<QuaggaMod["onDetected"]>[0];
    let quaggaCb: QuaggaCb | null = null;

    const parar = () => {
      vivo = false;
      if (raf) cancelAnimationFrame(raf);
      if (timeout != null) clearTimeout(timeout);
      if (quaggaAtivo && Quagga) {
        try {
          if (quaggaCb) Quagga.offDetected(quaggaCb);
        } catch {
          /* noop */
        }
        try {
          void Quagga.stop();
        } catch {
          /* noop */
        }
        try {
          void Quagga.CameraAccess.release();
        } catch {
          /* noop */
        }
        quaggaAtivo = false;
      }
      if (stream) stream.getTracks().forEach((x) => x.stop());
      stream = null;
    };

    const ok = (x: string) => {
      if (!vivo) return;
      vivo = false;
      navigator.vibrate?.(100);
      setMsg("Código detectado ✓");
      setTimeout(() => onDetected(String(x)), 400);
    };

    const desistir = () => {
      if (vivo) {
        parar();
        alert(
          "Nenhum código detectado. Tente aproximar, focar e manter firme — ou digite o código.",
        );
        onClose();
      }
    };

    const onKey = (x: KeyboardEvent) => {
      if (x.key === "Escape") {
        parar();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);

    void (async () => {
      try {
        if (nativo) {
          const s = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (!vivo) {
            s.getTracks().forEach((x) => x.stop());
            return;
          }
          stream = s;
          const v = vidRef.current;
          if (!v) return;
          v.srcObject = stream;
          await v.play();
          const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
            .BarcodeDetector;
          const det = new Ctor({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
          });
          const laco = async () => {
            if (!vivo) return;
            try {
              const achou = await det.detect(v);
              if (achou && achou.length && achou[0].rawValue) {
                ok(achou[0].rawValue);
                return;
              }
            } catch {
              /* frame sem código */
            }
            raf = requestAnimationFrame(() => void laco());
          };
          timeout = setTimeout(desistir, 45e3);
          void laco();
        } else if (hasQuagga()) {
          const alvoQ = boxRef.current;
          if (!alvoQ) return;
          const mod = await import("@ericblade/quagga2");
          const Q = mod.default;
          Quagga = Q;
          if (!vivo) return;
          await new Promise<void>((res, rej) => {
            Q.init(
              {
                inputStream: {
                  type: "LiveStream",
                  target: alvoQ,
                  constraints: { facingMode: { ideal: "environment" } },
                },
                locator: { patchSize: "medium", halfSample: true },
                numOfWorkers: 0,
                frequency: 10,
                decoder: {
                  readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader"],
                },
                locate: true,
              },
              (x) => (x ? rej(x) : res()),
            );
          });
          if (!vivo) {
            try {
              void Q.stop();
            } catch {
              /* noop */
            }
            try {
              void Q.CameraAccess.release();
            } catch {
              /* noop */
            }
            return;
          }
          quaggaAtivo = true;
          Q.start();
          setMsg("Aponte a câmera para o código de barras");
          quaggaCb = (x) => {
            const c = x && x.codeResult && x.codeResult.code;
            if (c) {
              const errs = (x.codeResult.decodedCodes || []).filter(
                (d) => d.error !== undefined,
              );
              const med = errs.length
                ? errs.reduce((a, d) => a + (d.error ?? 0), 0) / errs.length
                : 0;
              if (med < 0.15) ok(c);
            }
          };
          Q.onDetected(quaggaCb);
          timeout = setTimeout(desistir, 45e3);
        }
      } catch (z) {
        const nome = z instanceof Error ? z.name : "";
        setMsg(
          nome === "NotAllowedError" || nome === "PermissionDeniedError"
            ? "Permissão de câmera negada. Libere o acesso à câmera para este site e tente de novo."
            : "Não foi possível abrir a câmera. Verifique a permissão do navegador — ou digite o código.",
        );
      }
    })();

    return () => {
      window.removeEventListener("keydown", onKey);
      parar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Leitor de código de barras"
    >
      {nativo ? (
        <video ref={vidRef} className="h-full w-full object-cover" playsInline muted />
      ) : (
        <div ref={boxRef} className="barcode-box h-full w-full" />
      )}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
        <div className="max-w-md rounded-lg bg-black/60 px-3 py-2 text-sm text-white">{msg}</div>
        <button
          onClick={onClose}
          className="h-10 w-10 flex-shrink-0 rounded-full bg-white text-xl text-gray-900"
          aria-label="Fechar câmera"
        >
          ×
        </button>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-xl border-2 border-white"
          style={{ width: "78%", height: "34%" }}
        />
      </div>
    </div>,
    document.body,
  );
}
