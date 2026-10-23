import { describe, expect, it } from "vitest";
import { caminhoFoto, extensaoFoto, fotoSincronizada, hashFoto, planejarFotos } from "./fotos";

const WEBP = "data:image/webp;base64,AAAA";
const WEBP2 = "data:image/webp;base64,BBBB";
const JPG = "data:image/jpeg;base64,CCCC";
const U = "user-1";

describe("caminho e versão da foto", () => {
  it("hash muda quando a foto muda", () => {
    expect(hashFoto(WEBP)).toHaveLength(8);
    expect(hashFoto(WEBP)).not.toBe(hashFoto(WEBP2));
  });

  it("extensão pelo tipo; PNG não é aceito", () => {
    expect(extensaoFoto(WEBP)).toBe("webp");
    expect(extensaoFoto(JPG)).toBe("jpg");
    expect(extensaoFoto("data:image/png;base64,x")).toBeNull();
    expect(caminhoFoto(U, "p1", "data:image/png;base64,x")).toBeNull();
  });

  it("caminho na pasta do usuário", () => {
    expect(caminhoFoto(U, "p1", WEBP)).toBe(U + "/p1-" + hashFoto(WEBP) + ".webp");
  });

  it("sincronizada só quando o caminho bate com a foto atual", () => {
    const caminho = caminhoFoto(U, "p1", WEBP)!;
    expect(fotoSincronizada({ uid: "p1", image: WEBP, imagePath: caminho })).toBe(true);
    expect(fotoSincronizada({ uid: "p1", image: WEBP2, imagePath: caminho })).toBe(false);
    expect(fotoSincronizada({ uid: "p1", image: WEBP, imagePath: null })).toBe(false);
    expect(fotoSincronizada({ uid: "p1", image: null, imagePath: caminho })).toBe(false);
  });
});

describe("planejarFotos", () => {
  it("envia foto nova e aponta o produto para ela", () => {
    const r = planejarFotos(U, [{ id: "p1", image: WEBP }], []);
    expect(r.enviar).toEqual([{ id: "p1", caminho: caminhoFoto(U, "p1", WEBP), image: WEBP }]);
    expect(r.remover).toEqual([]);
  });

  it("arquivo já existe: só atualiza o caminho", () => {
    const c = caminhoFoto(U, "p1", WEBP)!;
    const r = planejarFotos(U, [{ id: "p1", image: WEBP, imagePath: null }], [c]);
    expect(r.enviar).toEqual([]);
    expect(r.atualizarCaminho).toEqual([{ id: "p1", caminho: c }]);
  });

  it("foto trocada: envia a nova e remove a antiga", () => {
    const antigo = caminhoFoto(U, "p1", WEBP)!;
    const r = planejarFotos(U, [{ id: "p1", image: WEBP2, imagePath: null }], [antigo]);
    expect(r.enviar[0].caminho).toBe(caminhoFoto(U, "p1", WEBP2));
    expect(r.remover).toEqual([antigo]);
  });

  it("aparelho novo: baixa quando há caminho e não há cópia local", () => {
    const c = caminhoFoto(U, "p1", WEBP)!;
    const r = planejarFotos(U, [{ id: "p1", image: null, imagePath: c }], [c]);
    expect(r.baixar).toEqual([{ id: "p1", caminho: c }]);
    expect(r.remover).toEqual([]);
  });

  it("caminho para arquivo inexistente ou de outra pasta: limpa", () => {
    const r = planejarFotos(
      U,
      [
        { id: "p1", image: null, imagePath: U + "/sumiu.webp" },
        { id: "p2", image: null, imagePath: "outro/p2-x.webp" },
      ],
      [],
    );
    expect(r.limparCaminho).toEqual(["p1", "p2"]);
  });

  it("não remove arquivos protegidos (publicados no catálogo de todos)", () => {
    const c = U + "/apagado-123.webp";
    expect(planejarFotos(U, [], [c], [c]).remover).toEqual([]);
    expect(planejarFotos(U, [], [c]).remover).toEqual([c]);
  });
});
