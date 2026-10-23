// ===========================================================================
//  Sincronização da base local (IndexedDB) com a conta no Supabase.
//
//  Modelo: o IndexedDB continua sendo a base de trabalho (o app abre e funciona
//  offline). A conta guarda um SNAPSHOT completo, no formato do backup v3, numa
//  linha `account_data` por usuário. Cada gravação passa pela RPC
//  `save_account_data`, que só aceita a escrita se a revisão conhecida pelo
//  aparelho for a revisão atual da nuvem (controle otimista de concorrência).
//  Revisão divergente = outro aparelho gravou antes; o local vira cópia em
//  "Backups automáticos" e a versão da nuvem é aplicada. Nada é descartado sem
//  cópia, exceto a base de OUTRA conta, que nunca pode ficar no aparelho.
//
//  Toda alteração em tabela observada (hooks do Dexie) marca a base como
//  pendente e agenda um envio com debounce.
// ===========================================================================

import type { Table } from "dexie";
import { repos } from "@/data";
import { db } from "@/db/schema";
import { seedIfEmpty } from "@/db/seed";
import { backupJson } from "@/domain/backup";
import { supabase } from "@/integrations/supabase";
import { decidirReconciliacao } from "./reconcile";
import {
  DUMP_VAZIO,
  LIMITE_SNAPSHOT_BYTES,
  montarSnapshot,
  preservarFotosLocais,
  snapshotParaDump,
} from "./snapshot";

export interface Conta {
  id: string;
  email: string;
}

export type FaseSync = "parado" | "ocioso" | "enviando" | "baixando" | "offline" | "erro";

export interface StatusSync {
  fase: FaseSync;
  pendente: boolean;
  ultimaSync: number | null;
  erro: string | null;
  /** mensagem que o usuário precisa ver uma vez (ex.: conflito resolvido). */
  aviso: string | null;
}

export type ResultadoReconciliacao = { ok: true; offline: boolean } | { ok: false; msg: string };

interface EstadoLocal {
  dono: Conta | null;
  revisao: number;
  pendente: boolean;
  ultimaSync: number | null;
}

const CHAVE_ESTADO = "mercado.conta.v1";
const DEBOUNCE_MS = 2500;
const INTERVALO_VERIFICACAO_MS = 30_000;
const COPIAS_MAX = 3; // mesmo teto das cópias automáticas da Config
const MSG_COPIA =
  "Os dados deste aparelho foram guardados como cópia em Config → Backups automáticos.";

// ---------------------------------------------------------------------------
//  Estado persistido (localStorage). Lido sempre do armazenamento, nunca de
//  cache em memória: duas abas compartilham a mesma base e a mesma revisão.
// ---------------------------------------------------------------------------

const ESTADO_VAZIO: EstadoLocal = { dono: null, revisao: 0, pendente: false, ultimaSync: null };

function lerEstado(): EstadoLocal {
  try {
    const bruto = localStorage.getItem(CHAVE_ESTADO);
    if (!bruto) return { ...ESTADO_VAZIO };
    const o = JSON.parse(bruto) as Partial<EstadoLocal>;
    const dono =
      o.dono && typeof o.dono.id === "string"
        ? { id: o.dono.id, email: String(o.dono.email ?? "") }
        : null;
    return {
      dono,
      revisao: Number.isFinite(o.revisao) ? Number(o.revisao) : 0,
      pendente: !!o.pendente,
      ultimaSync: typeof o.ultimaSync === "number" ? o.ultimaSync : null,
    };
  } catch {
    return { ...ESTADO_VAZIO };
  }
}

function gravarEstado(patch: Partial<EstadoLocal>): EstadoLocal {
  const novo = { ...lerEstado(), ...patch };
  try {
    localStorage.setItem(CHAVE_ESTADO, JSON.stringify(novo));
  } catch {
    /* armazenamento bloqueado: a sincronização segue só em memória nesta sessão */
  }
  return novo;
}

/** dono registrado da base local — usado para entrar offline com sessão expirada. */
export function donoLocal(): Conta | null {
  return lerEstado().dono;
}

// ---------------------------------------------------------------------------
//  Status observável (useSyncExternalStore)
// ---------------------------------------------------------------------------

let status: StatusSync = {
  fase: "parado",
  pendente: false,
  ultimaSync: null,
  erro: null,
  aviso: null,
};
const ouvintes = new Set<() => void>();

function setStatus(patch: Partial<StatusSync>) {
  status = { ...status, ...patch };
  ouvintes.forEach((fn) => fn());
}

export function assinarStatus(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function lerStatus(): StatusSync {
  return status;
}

export function dispensarAviso() {
  setStatus({ aviso: null });
}

// ---------------------------------------------------------------------------
//  Rede
// ---------------------------------------------------------------------------

class ErroRede extends Error {}

function ehErroRede(msg: string | undefined): boolean {
  return (
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(msg ?? "")
  );
}

function cliente() {
  if (!supabase) throw new Error("Supabase não configurado neste build.");
  return supabase;
}

interface LinhaRemota {
  revision: number;
  data?: unknown;
}

async function buscarRemoto(usuarioId: string, comDados: boolean): Promise<LinhaRemota | null> {
  const { data, error } = await cliente()
    .from("account_data")
    .select(comDados ? "revision, data" : "revision")
    .eq("user_id", usuarioId)
    .maybeSingle();
  if (error) {
    if (ehErroRede(error.message)) throw new ErroRede(error.message);
    throw new Error(error.message);
  }
  if (!data) return null;
  const linha = data as unknown as LinhaRemota;
  return { revision: Number(linha.revision), data: linha.data };
}

/** serializa operações de rede entre abas; sem Web Locks, só dentro da aba. */
let filaLocal: Promise<unknown> = Promise.resolve();
function comTrava<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (locks?.request) return locks.request("mercado-sync", fn) as Promise<T>;
  const p = filaLocal.then(fn, fn);
  filaLocal = p.catch(() => undefined);
  return p;
}

// ---------------------------------------------------------------------------
//  Aplicação na base local
// ---------------------------------------------------------------------------

/** true enquanto a própria sincronização escreve na base: os hooks ignoram. */
let aplicando = false;

async function semMarcar<T>(fn: () => Promise<T>): Promise<T> {
  aplicando = true;
  try {
    return await fn();
  } finally {
    aplicando = false;
  }
}

async function aplicarRemoto(conta: Conta, linha: LinhaRemota): Promise<void> {
  const dump = preservarFotosLocais(snapshotParaDump(linha.data), await db.products.toArray());
  await semMarcar(() => repos.backup.restoreAll(dump));
  gravarEstado({ dono: conta, revisao: linha.revision, pendente: false, ultimaSync: Date.now() });
}

async function guardarCopiaLocal(): Promise<void> {
  const data = await backupJson(await repos.backup.dumpAll());
  await repos.backup.addAuto({ date: Date.now(), data });
  await repos.backup.trimAuto(COPIAS_MAX);
}

/** zera tabelas e cópias automáticas — usado ao trocar de conta e ao sair. */
async function limparBase(): Promise<void> {
  await semMarcar(async () => {
    await repos.backup.restoreAll(DUMP_VAZIO);
    await db.autoBackups.clear();
  });
}

// ---------------------------------------------------------------------------
//  Detecção de alterações locais
// ---------------------------------------------------------------------------

let contaAtual: Conta | null = null;
let seq = 0;
let timerEnvio: ReturnType<typeof setTimeout> | null = null;
let ultimaVerificacao = 0;

function marcarAlteracao() {
  if (aplicando || !contaAtual) return;
  seq++;
  // Lê do armazenamento, não de `status`: outra aba pode ter enviado e zerado a pendência.
  if (!lerEstado().pendente) gravarEstado({ pendente: true });
  if (!status.pendente) setStatus({ pendente: true });
  agendarEnvio();
}

// Os hooks do Dexie usam o retorno: em "creating" vira a chave e em "updating"
// vira modificação. Esta função precisa devolver undefined.
function hook(): void {
  marcarAlteracao();
}

function tabelasObservadas(): Table[] {
  return db.tables.filter((t) => t.name !== "autoBackups");
}

function ligarHooks() {
  for (const t of tabelasObservadas()) {
    t.hook("creating", hook);
    t.hook("updating", hook);
    t.hook("deleting", hook);
  }
}

function desligarHooks() {
  for (const t of tabelasObservadas()) {
    t.hook("creating").unsubscribe(hook);
    t.hook("updating").unsubscribe(hook);
    t.hook("deleting").unsubscribe(hook);
  }
}

function agendarEnvio(ms = DEBOUNCE_MS) {
  if (timerEnvio) clearTimeout(timerEnvio);
  timerEnvio = setTimeout(() => {
    timerEnvio = null;
    void enviar();
  }, ms);
}

// ---------------------------------------------------------------------------
//  Envio / recebimento
// ---------------------------------------------------------------------------

function falhou(e: unknown) {
  if (e instanceof ErroRede || ehErroRede((e as Error)?.message)) {
    setStatus({ fase: "offline", erro: null });
  } else {
    setStatus({ fase: "erro", erro: (e as Error)?.message || String(e) });
  }
}

async function resolverConflito(conta: Conta): Promise<void> {
  const remoto = await buscarRemoto(conta.id, true);
  if (!remoto) {
    // a linha sumiu entre a tentativa e agora: a próxima gravação recria.
    gravarEstado({ revisao: 0 });
    agendarEnvio(0);
    return;
  }
  await guardarCopiaLocal();
  setStatus({ fase: "baixando" });
  await aplicarRemoto(conta, remoto);
  setStatus({
    aviso: "Havia uma versão mais nova da sua conta salva por outro aparelho. " + MSG_COPIA,
  });
}

export async function enviar(): Promise<void> {
  const conta = contaAtual;
  if (!conta) return;
  if (navigator.onLine === false) {
    setStatus({ fase: "offline" });
    return;
  }
  try {
    await comTrava(async () => {
      const est = lerEstado();
      if (!est.pendente || est.dono?.id !== conta.id) return;
      const seqAntes = seq;
      setStatus({ fase: "enviando", erro: null });

      const snapshot = montarSnapshot(await repos.backup.dumpAll());
      const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).length;
      if (bytes > LIMITE_SNAPSHOT_BYTES) {
        throw new Error(
          "Os dados passam do limite de 20 MB da conta. Remova fotos de produtos para liberar espaço.",
        );
      }

      const { data, error } = await cliente().rpc("save_account_data", {
        p_data: snapshot,
        p_expected_revision: est.revisao,
      });
      if (error) {
        if (ehErroRede(error.message)) throw new ErroRede(error.message);
        throw new Error(error.message);
      }
      if (data == null) {
        await resolverConflito(conta);
      } else {
        const aindaPendente = seq !== seqAntes;
        gravarEstado({ revisao: Number(data), pendente: aindaPendente, ultimaSync: Date.now() });
        if (aindaPendente) agendarEnvio();
      }
      const fim = lerEstado();
      setStatus({ fase: "ocioso", pendente: fim.pendente, ultimaSync: fim.ultimaSync });
    });
  } catch (e) {
    falhou(e);
  }
}

async function verificarRemoto(forcar = false): Promise<void> {
  const conta = contaAtual;
  if (!conta || navigator.onLine === false) return;
  if (!forcar && Date.now() - ultimaVerificacao < INTERVALO_VERIFICACAO_MS) return;
  ultimaVerificacao = Date.now();

  if (lerEstado().pendente) return enviar();
  try {
    await comTrava(async () => {
      const est = lerEstado();
      const remoto = await buscarRemoto(conta.id, false);
      if (remoto && remoto.revision !== est.revisao && !est.pendente) {
        setStatus({ fase: "baixando", erro: null });
        const completo = await buscarRemoto(conta.id, true);
        if (completo) await aplicarRemoto(conta, completo);
      } else if (!remoto) {
        gravarEstado({ pendente: true });
        agendarEnvio(0);
      }
      const fim = lerEstado();
      setStatus({ fase: "ocioso", erro: null, pendente: fim.pendente, ultimaSync: fim.ultimaSync });
    });
  } catch (e) {
    falhou(e);
  }
}

// ---------------------------------------------------------------------------
//  Ciclo de vida
// ---------------------------------------------------------------------------

/**
 * Roda no login, ANTES de qualquer tela ler a base: garante que o aparelho só
 * mostre dados da conta que entrou.
 */
export async function reconciliar(conta: Conta): Promise<ResultadoReconciliacao> {
  const est = lerEstado();
  let revisaoRemota: number | null;
  try {
    revisaoRemota = (await buscarRemoto(conta.id, false))?.revision ?? null;
  } catch (e) {
    if (!(e instanceof ErroRede)) return { ok: false, msg: (e as Error).message };
    if (est.dono?.id === conta.id) return { ok: true, offline: true };
    if (est.dono == null) {
      // Sem rede e base sem dono: segue com ela. Se a conta já tiver dados, o
      // primeiro envio dá conflito e a base local vira cópia antes de baixar.
      gravarEstado({ dono: conta, revisao: 0, pendente: true });
      return { ok: true, offline: true };
    }
    return {
      ok: false,
      msg: "Este aparelho tem dados de outra conta. Conecte-se à internet para carregar os seus.",
    };
  }

  const acao = decidirReconciliacao({
    usuarioId: conta.id,
    dono: est.dono?.id ?? null,
    pendente: est.pendente,
    revisaoLocal: est.revisao,
    revisaoRemota,
  });

  try {
    switch (acao) {
      case "nada":
        gravarEstado({ dono: conta });
        break;
      case "enviar":
        gravarEstado({ dono: conta, pendente: true });
        break;
      case "adotar":
        gravarEstado({ dono: conta, revisao: 0, pendente: true });
        break;
      case "limpar":
        await limparBase();
        gravarEstado({ dono: conta, revisao: 0, pendente: true, ultimaSync: null });
        break;
      case "baixar":
      case "substituir":
      case "conflito": {
        if (acao === "substituir") await limparBase();
        if (acao === "conflito") await guardarCopiaLocal();
        const remoto = await buscarRemoto(conta.id, true);
        if (remoto) await aplicarRemoto(conta, remoto);
        if (acao === "conflito") {
          setStatus({
            aviso: est.dono
              ? "Outro aparelho salvou uma versão mais nova da sua conta. " + MSG_COPIA
              : MSG_COPIA,
          });
        }
        break;
      }
    }
  } catch (e) {
    if (e instanceof ErroRede) return { ok: false, msg: "Conexão perdida ao carregar a conta." };
    return { ok: false, msg: (e as Error).message };
  }
  return { ok: true, offline: false };
}

function aoVoltarRede() {
  void (lerEstado().pendente ? enviar() : verificarRemoto(true));
}

function aoMudarVisibilidade() {
  if (document.visibilityState === "visible") void verificarRemoto();
  else if (lerEstado().pendente) void enviar();
}

/** liga a sincronização em segundo plano para a conta já reconciliada. */
export function iniciar(conta: Conta, offline: boolean) {
  parar();
  contaAtual = conta;
  seq = 0;
  ligarHooks();
  window.addEventListener("online", aoVoltarRede);
  document.addEventListener("visibilitychange", aoMudarVisibilidade);
  const est = lerEstado();
  setStatus({
    fase: offline ? "offline" : "ocioso",
    pendente: est.pendente,
    ultimaSync: est.ultimaSync,
    erro: null,
  });
  if (est.pendente && !offline) agendarEnvio(0);
}

export function parar() {
  if (timerEnvio) clearTimeout(timerEnvio);
  timerEnvio = null;
  if (contaAtual) {
    desligarHooks();
    window.removeEventListener("online", aoVoltarRede);
    document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }
  contaAtual = null;
  setStatus({ fase: "parado" });
}

export async function sincronizarAgora(): Promise<void> {
  if (lerEstado().pendente) return enviar();
  return verificarRemoto(true);
}

/** envia o que estiver pendente; devolve true se ainda sobrou pendência. */
export async function descarregar(): Promise<boolean> {
  if (timerEnvio) {
    clearTimeout(timerEnvio);
    timerEnvio = null;
  }
  if (lerEstado().pendente) await enviar();
  return lerEstado().pendente;
}

/**
 * Apaga os dados da CONTA (nuvem e este aparelho) e recomeça do catálogo
 * inicial. Exige conexão: sem ela, o próximo login baixaria a versão antiga da
 * nuvem e o "apagar" seria desfeito em silêncio.
 */
export async function apagarDadosDaConta(): Promise<void> {
  const conta = contaAtual;
  if (!conta) throw new Error("Nenhuma conta conectada.");
  if (navigator.onLine === false) {
    throw new Error("Sem conexão. Conecte-se para apagar os dados da conta.");
  }
  await comTrava(async () => {
    // A revisão atual da nuvem vira a esperada: o envio a seguir sobrescreve sem conflito.
    const remoto = await buscarRemoto(conta.id, false);
    await limparBase();
    await seedIfEmpty();
    gravarEstado({ revisao: remoto?.revision ?? 0, pendente: true });
  });
  await descarregar();
  if (lerEstado().pendente) {
    throw new Error(
      "Os dados foram apagados neste aparelho, mas o envio para a conta falhou. Tente “Sincronizar agora”.",
    );
  }
}

/** Encerra a sessão: apaga a base local e o estado da conta deste aparelho. */
export async function encerrarSessao(): Promise<void> {
  parar();
  await limparBase();
  try {
    localStorage.removeItem(CHAVE_ESTADO);
  } catch {
    /* ignore */
  }
  // scope "local": encerra só este aparelho; os demais continuam conectados.
  await cliente().auth.signOut({ scope: "local" });
}
