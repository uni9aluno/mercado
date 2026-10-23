// ===========================================================================
//  Publicação automática no "catálogo de todos".
//
//  Todo produto de qualquer conta fica visível para todos os usuários. Depois
//  de cada sincronização bem-sucedida, publica os produtos desta conta que
//  ainda não foram publicados por este aparelho (ou que ganharam foto nova).
//  Funciona para qualquer forma de cadastro (tela Produtos, código de barras,
//  Excel, lista importada) sem tocar em cada uma delas. Nunca sai preço.
// ===========================================================================

import { repos } from "@/data";
import { pendentesDePublicacao } from "@/domain/sharedCatalog";
import { publicarItens } from "@/integrations/sharedCatalog";
import { assinarStatus, lerStatus, type Conta } from "./accountSync";

let conta: Conta | null = null;
let cancelar: (() => void) | null = null;
let ultimaVista: number | null = null;
let emAndamento: Promise<number> | null = null;

const chaveLocal = (uid: string) => "mercado.catalogo.publicados." + uid;

function lerPublicadas(uid: string): Set<string> {
  try {
    const bruto = localStorage.getItem(chaveLocal(uid));
    const arr = bruto ? (JSON.parse(bruto) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function gravarPublicadas(uid: string, chaves: Set<string>) {
  try {
    localStorage.setItem(chaveLocal(uid), JSON.stringify([...chaves]));
  } catch {
    /* sem armazenamento: na próxima vez publica de novo; o banco ignora duplicados */
  }
}

/**
 * Publica o que falta. `manual` propaga erros (botão da Config); em segundo
 * plano, falhas ficam em silêncio e tentam de novo depois.
 * Devolve quantos produtos foram enviados.
 */
export function publicarPendentes(manual = false): Promise<number> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    const c = conta;
    if (!c) return 0;
    if (navigator.onLine === false) {
      if (manual) throw new Error("Sem conexão.");
      return 0;
    }
    const publicadas = lerPublicadas(c.id);
    const pendentes = pendentesDePublicacao(await repos.products.all(), publicadas);
    if (!pendentes.length) return 0;
    try {
      const aceitas = await publicarItens(pendentes, c.id);
      aceitas.forEach((k) => publicadas.add(k));
      gravarPublicadas(c.id, publicadas);
      return aceitas.length;
    } catch (e) {
      if (manual) throw e;
      return 0;
    }
  })().finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}

export function iniciarPublicador(c: Conta) {
  pararPublicador();
  conta = c;
  ultimaVista = lerStatus().ultimaSync;
  cancelar = assinarStatus(() => {
    const s = lerStatus();
    if (s.fase === "ocioso" && s.ultimaSync !== ultimaVista) {
      ultimaVista = s.ultimaSync;
      void publicarPendentes();
    }
  });
  void publicarPendentes();
}

export function pararPublicador() {
  cancelar?.();
  cancelar = null;
  conta = null;
}
