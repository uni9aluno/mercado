import { describe, expect, it } from "vitest";
import { emailValido, validarSenhaNova } from "./authErrors";

describe("validarSenhaNova", () => {
  it("exige tamanho mínimo", () => {
    expect(validarSenhaNova("abc123", "abc123")).toMatch(/8 caracteres/);
  });

  it("exige letras e números", () => {
    expect(validarSenhaNova("abcdefgh", "abcdefgh")).toMatch(/letras e números/);
    expect(validarSenhaNova("12345678", "12345678")).toMatch(/letras e números/);
  });

  it("exige confirmação igual", () => {
    expect(validarSenhaNova("senha1234", "senha1235")).toMatch(/não conferem/);
  });

  it("aceita senha válida", () => {
    expect(validarSenhaNova("senha1234", "senha1234")).toBeNull();
  });
});

describe("emailValido", () => {
  it("aceita e recusa formatos básicos", () => {
    expect(emailValido("ana@exemplo.com")).toBe(true);
    expect(emailValido(" ana@exemplo.com ")).toBe(true);
    expect(emailValido("ana@exemplo")).toBe(false);
    expect(emailValido("ana exemplo.com")).toBe(false);
  });
});
