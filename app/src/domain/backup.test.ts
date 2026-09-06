import { describe, expect, it } from "vitest";
import type { BackupDump } from "@/data/types";
import type { Product, ShoppingItem, ShoppingList, Store } from "@/db/types";
import {
  backupJson,
  buildBackup,
  codificarLista,
  conferirChecksum,
  decodificarLista,
  listaParaCodigo,
  planejarImportacao,
  sha256Hex,
} from "./backup";

const dumpVazio: BackupDump = {
  categories: [],
  stores: [],
  products: [],
  purchases: [],
  purchaseItems: [],
  shoppingLists: [],
  shoppingItems: [],
  settings: [],
};

const dumpExemplo: BackupDump = {
  ...dumpVazio,
  categories: [{ uid: "c1", name: "Açougue" }],
  products: [
    {
      uid: "p1",
      name: "Carne",
      category: "Açougue",
      categoryId: "c1",
      frequency: "30 dias",
      barcode: null,
    },
  ],
  settings: [{ key: "budget", vrva: 300, extra: 1000 }],
};

describe("buildBackup", () => {
  it("monta a estrutura com as chaves diretas e sem autoBackups", () => {
    const ob = buildBackup(dumpExemplo);
    expect(ob.v).toBe(3);
    expect(ob.products).toHaveLength(1);
    expect(ob.settings).toEqual([{ key: "budget", vrva: 300, extra: 1000 }]);
    expect(ob).not.toHaveProperty("autoBackups");
    expect(ob).not.toHaveProperty("_checksum");
  });
});

describe("checksum", () => {
  it("sha256Hex devolve 64 hex", async () => {
    const h = await sha256Hex("abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("backupJson grava _checksum como última chave e conferirChecksum diz ok", async () => {
    const txt = await backupJson(dumpExemplo);
    const chaves = Object.keys(JSON.parse(txt));
    expect(chaves[chaves.length - 1]).toBe("_checksum");

    const { estado } = await conferirChecksum(txt);
    expect(estado).toBe("ok");
  });

  it("detecta adulteração (ruim)", async () => {
    const txt = await backupJson(dumpExemplo);
    const ob = JSON.parse(txt);
    ob.products[0].name = "Frango"; // mexe no conteúdo, mantém o _checksum
    const { estado } = await conferirChecksum(JSON.stringify(ob));
    expect(estado).toBe("ruim");
  });

  it("backup sem _checksum: estado 'sem'", async () => {
    const { estado } = await conferirChecksum(JSON.stringify(buildBackup(dumpExemplo)));
    expect(estado).toBe("sem");
  });
});

describe("codificar/decodificarLista", () => {
  const lista: ShoppingList = { id: "L1", name: "Feira", storeId: "s1", active: 1 };
  const itens: ShoppingItem[] = [
    { id: "i1", productId: "p1", status: "A comprar", priority: "Alta", listId: "L1", quantity: 2 },
    { id: "i2", productId: "p2", status: "A comprar", priority: "Média", listId: "L1", quantity: 1 },
    { id: "i3", productId: "p3", status: "Comprado", priority: "Baixa", listId: "L1", quantity: 1 },
  ];
  const productById = new Map<string, Product>([
    ["p1", { id: "p1", name: "Tomate", category: "H", frequency: "15 dias", barcode: null }],
    ["p2", { id: "p2", name: "Cebola", category: "H", frequency: "15 dias", barcode: null }],
    ["p3", { id: "p3", name: "Alho", category: "H", frequency: "30 dias", barcode: null }],
  ]);
  const storeById = new Map<string, Store>([["s1", { id: "s1", name: "Feira Livre" }]]);

  it("codifica só pendentes e volta igual (ida e volta)", async () => {
    const obj = listaParaCodigo(lista, itens, productById, storeById);
    expect(obj.i).toHaveLength(2); // p3 comprado fica de fora
    expect(obj.s).toBe("Feira Livre");

    const cod = await codificarLista(obj);
    expect(cod.startsWith("MDC1:") || cod.startsWith("MDC0:")).toBe(true);

    const volta = await decodificarLista(cod);
    expect(volta).toEqual(obj);
  });

  it("decodifica MDC0 (base64 puro)", async () => {
    const obj = { v: 1 as const, n: "L", s: "Loja", i: [["X", 1, "Média"]] as [string, number, string][] };
    // força MDC0 montando manualmente
    const b64 = btoa(new TextDecoder().decode(new TextEncoder().encode(JSON.stringify(obj))));
    const volta = await decodificarLista("MDC0:" + b64);
    expect(volta.n).toBe("L");
  });

  it("prefixo inválido lança", async () => {
    await expect(decodificarLista("XYZ:abc")).rejects.toThrow();
  });
});

describe("planejarImportacao", () => {
  const stores: Store[] = [
    { id: "s1", name: "Feira Livre de Bairro" },
    { id: "s2", name: "Supermercado Local" },
  ];

  it("casa o mercado por norm e normaliza prioridades", () => {
    const plano = planejarImportacao(
      {
        v: 1,
        n: "Minha lista de compras muito comprida que passa de sessenta caracteres fácil",
        s: "feira livre de bairro",
        i: [
          ["Tomate", 3, "Alta"],
          ["Cebola", 0, "Urgente"], // prioridade inválida -> Média; qty 0 -> 1
        ],
      },
      stores,
    );
    expect(plano.storeId).toBe("s1");
    expect(plano.nome.length).toBeLessThanOrEqual(60);
    expect(plano.itens[0]).toEqual({ nome: "Tomate", quantity: 3, priority: "Alta" });
    expect(plano.itens[1]).toEqual({ nome: "Cebola", quantity: 1, priority: "Média" });
  });

  it("sem mercado correspondente: storeId null", () => {
    const plano = planejarImportacao(
      { v: 1, n: "L", s: "Mercado que não existe", i: [["X", 1, "Média"]] },
      stores,
    );
    expect(plano.storeId).toBeNull();
  });

  it("lista sem itens lança", () => {
    expect(() => planejarImportacao({ v: 1, n: "L", s: "", i: [] }, stores)).toThrow();
  });
});
