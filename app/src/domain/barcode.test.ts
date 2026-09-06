import { describe, expect, it } from "vitest";
import { gtinValido, normalizarCodigo } from "./barcode";

describe("normalizarCodigo", () => {
  it("mantém só dígitos e corta em 14", () => {
    expect(normalizarCodigo("789 1234-567895")).toBe("7891234567895");
    expect(normalizarCodigo("abc")).toBe("");
    expect(normalizarCodigo("123456789012345678")).toBe("12345678901234");
    expect(normalizarCodigo(null)).toBe("");
    expect(normalizarCodigo(undefined)).toBe("");
  });
});

describe("gtinValido", () => {
  it("aceita EAN-13 com dígito verificador correto", () => {
    // exemplos reais de EAN-13 válidos
    expect(gtinValido("7891000100103")).toBe(true); // Nescau (usado na spec)
    expect(gtinValido("5901234123457")).toBe(true);
  });

  it("aceita EAN-8 e UPC-A válidos", () => {
    expect(gtinValido("40170725")).toBe(true); // EAN-8
    expect(gtinValido("036000291452")).toBe(true); // UPC-A
  });

  it("rejeita dígito verificador errado", () => {
    expect(gtinValido("7891000100104")).toBe(false);
    expect(gtinValido("5901234123456")).toBe(false);
  });

  it("rejeita comprimentos fora de 8/12/13/14", () => {
    expect(gtinValido("123")).toBe(false);
    expect(gtinValido("123456789")).toBe(false);
    expect(gtinValido("")).toBe(false);
  });
});
