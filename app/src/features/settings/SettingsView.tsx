import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { repos } from "@/data";
import type { BudgetSettings, Priority, RulesSettings } from "@/db/types";
import {
  codificarLista,
  decodificarLista,
  listaParaCodigo,
  planejarImportacao,
} from "@/domain/backup";
import {
  useCategories,
  useDerived,
  useLists,
  usePriceIndex,
  useProducts,
  usePurchaseItems,
  usePurchases,
  useSetting,
  useShoppingItems,
  useStores,
} from "@/hooks";
import { useMaps } from "@/hooks";
import { PRIORITIES } from "@/lib/constants";
import { daysSince, norm } from "@/lib/text";
import { Btn, Dica, Icon, inputCls } from "@/ui";
import {
  AUTO_MAX,
  autoBackupRodar,
  baixarBackup,
  compartilharBackup,
  lerAutoBackups,
  podeCompartilharBackup,
  restaurarDeTexto,
  type ResumoAuto,
} from "./backupActions";
import { deviceLabel, fmtWhen, humanBytes } from "./deviceInfo";
import { EanCatalogPanel } from "./EanCatalogPanel";
import { exportarExcel, planejarImportProdutos } from "./excelActions";
import { FileButton } from "./FileButton";
import { Panel } from "./Panel";

const AVISO_MS = 2500;

export function SettingsView() {
  const products = useProducts();
  const stores = useStores();
  const categories = useCategories();
  const purchases = usePurchases();
  const purchaseItems = usePurchaseItems();
  const lists = useLists();
  const shoppingItems = useShoppingItems();
  const { priceIndex, purchaseById } = usePriceIndex();
  const { productById, storeById } = useMaps();
  const derived = useDerived();

  const budgetRow = useSetting<BudgetSettings>("budget");
  const rulesRow = useSetting<RulesSettings>("rules");

  // formulários locais, semeados a partir do settings vivo
  const [budget, setBudget] = useState({ vrva: "", extra: "" });
  const [rules, setRules] = useState({
    tolerance: 0.1,
    savingsGoal: 100,
    targetDiscount: 0.05,
    vrvaExpiryDay: 30,
  });
  useEffect(() => {
    if (budgetRow) {
      setBudget({ vrva: String(budgetRow.vrva ?? 0), extra: String(budgetRow.extra ?? 0) });
    }
  }, [budgetRow]);
  useEffect(() => {
    if (rulesRow) {
      setRules({
        tolerance: rulesRow.tolerance ?? 0.1,
        savingsGoal: rulesRow.savingsGoal ?? 100,
        targetDiscount: rulesRow.targetDiscount ?? 0.05,
        vrvaExpiryDay: rulesRow.vrvaExpiryDay ?? 30,
      });
    }
  }, [rulesRow]);

  // novos mercado/categoria
  const [novoMercado, setNovoMercado] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");

  // painel cinza + auto-backups
  const [uso, setUso] = useState<number | null>(null);
  const [protegido, setProtegido] = useState<boolean | null>(null);
  const [auto, setAuto] = useState<ResumoAuto>({
    quantidade: 0,
    maisRecente: null,
    dataUltimo: null,
  });

  // compartilhar/importar lista por código
  const [codImport, setCodImport] = useState("");
  const [listaShareId, setListaShareId] = useState("");
  const [codGerado, setCodGerado] = useState("");

  // faixa de aviso efêmera
  const [aviso, setAvisoRaw] = useState("");
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => {
    setAvisoRaw(m);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAvisoRaw(""), AVISO_MS);
  };
  useEffect(() => () => void (avisoTimer.current && clearTimeout(avisoTimer.current)), []);

  const recarregarAuto = () => void lerAutoBackups().then(setAuto);

  useEffect(() => {
    recarregarAuto();
    try {
      navigator.storage?.estimate?.().then((e) => setUso(e?.usage ?? null)).catch(() => {});
      navigator.storage?.persisted?.().then(setProtegido).catch(() => {});
    } catch {
      /* API indisponível */
    }
  }, []);

  // auto-backup: uma vez por sessão, no boot da tela (mesmo gatilho do original)
  const jaRodou = useRef(false);
  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;
    void autoBackupRodar().then(recarregarAuto);
  }, []);

  const totalOrcamento = Number(budget.vrva || 0) + Number(budget.extra || 0);

  const listasAtivas = useMemo(() => lists.filter((l) => l.active), [lists]);
  const itensPorLista = useMemo(() => {
    const m = new Map<string, typeof shoppingItems>();
    for (const it of shoppingItems) {
      const arr = m.get(it.listId) ?? [];
      arr.push(it);
      m.set(it.listId, arr);
    }
    return m;
  }, [shoppingItems]);

  // -------------------------------------------------------------------------
  //  Handlers
  // -------------------------------------------------------------------------

  async function salvarOrcamento() {
    await repos.settings.put({
      key: "budget",
      vrva: Number(budget.vrva) || 0,
      extra: Number(budget.extra) || 0,
    });
    flash("Orçamento atualizado.");
  }

  async function salvarRegras() {
    await repos.settings.put({
      key: "rules",
      tolerance: Number(rules.tolerance) || 0,
      savingsGoal: Number(rules.savingsGoal) || 0,
      targetDiscount: Number(rules.targetDiscount) || 0,
      vrvaExpiryDay: Math.min(31, Math.max(1, Number(rules.vrvaExpiryDay) || 30)),
    });
    flash("Regras atualizadas.");
  }

  async function incluirMercado() {
    const nome = novoMercado.trim();
    if (!nome) return;
    await repos.stores.create(nome);
    setNovoMercado("");
  }

  async function renomearMercado(id: string, atual: string) {
    const novo = window.prompt("Novo nome do mercado", atual);
    if (novo == null) return;
    const limpo = novo.trim();
    if (!limpo || limpo === atual) return;
    await repos.stores.update(id, { name: limpo });
  }

  async function excluirMercado(id: string) {
    if (
      purchases.some((p) => p.storeId === id) &&
      !window.confirm(
        "Este mercado tem compras registradas. Excluir mesmo assim? O histórico mantém o nome.",
      )
    ) {
      return;
    }
    const usadoPor = lists.filter((l) => l.storeId === id);
    if (
      usadoPor.length &&
      !window.confirm(
        usadoPor.length + " lista(s) usam este mercado. Excluir? As listas ficam sem mercado.",
      )
    ) {
      return;
    }
    for (const l of usadoPor) await repos.lists.updateList(l.id, { storeId: null });
    await repos.stores.remove(id);
  }

  async function incluirCategoria() {
    const nome = novaCategoria.trim();
    if (!nome) return;
    await repos.categories.create(nome);
    setNovaCategoria("");
  }

  async function renomearCategoria(id: string, atual: string) {
    const novo = window.prompt("Novo nome da categoria", atual);
    if (novo == null) return;
    const limpo = novo.trim();
    if (!limpo || limpo === atual) return;
    await repos.categories.update(id, { name: limpo });
  }

  async function excluirCategoria(id: string, nome: string) {
    if (products.some((p) => p.category === nome)) {
      window.alert("Existem produtos nesta categoria. Mova-os antes de excluir.");
      return;
    }
    await repos.categories.remove(id);
  }

  async function protegerArmazenamento() {
    try {
      const ok = await navigator.storage.persist();
      setProtegido(ok);
      flash(
        ok
          ? "Armazenamento protegido pelo navegador."
          : "O navegador não concedeu proteção. Mantenha backups em dia.",
      );
    } catch {
      flash("Este navegador não suporta proteção de armazenamento.");
    }
  }

  async function baixar() {
    try {
      await baixarBackup();
      flash("Backup baixado.");
    } catch (e) {
      flash("Não foi possível baixar: " + (e as Error).message);
    }
  }

  async function compartilhar() {
    try {
      await compartilharBackup();
      flash("Backup compartilhado.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        flash("Não foi possível compartilhar: " + (e as Error).message);
      }
    }
  }

  async function restaurarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (!window.confirm("Restaurar substitui TODOS os dados atuais. Continuar?")) return;
    const r = await restaurarDeTexto(await arquivo.text());
    if (r.ok) {
      flash("Backup restaurado.");
      recarregarAuto();
    } else if (r.motivo === "corrompido") {
      flash("Arquivo de backup corrompido. Tente transferir o arquivo de novo.");
    } else {
      flash("Arquivo de backup inválido" + (r.detalhe ? ": " + r.detalhe : "."));
    }
  }

  async function restaurarUltimoAuto() {
    if (!auto.dataUltimo || auto.maisRecente == null) return;
    if (
      !window.confirm(
        "Restaurar o backup automático de " +
          fmtWhen(new Date(auto.maisRecente).toISOString()) +
          "? Isso substitui TODOS os dados atuais.",
      )
    ) {
      return;
    }
    const r = await restaurarDeTexto(auto.dataUltimo);
    if (r.ok) {
      flash("Backup automático restaurado.");
      recarregarAuto();
    } else if (r.motivo === "corrompido") {
      flash("Backup automático corrompido.");
    } else {
      flash("Não foi possível restaurar" + (r.detalhe ? ": " + r.detalhe : "."));
    }
  }

  function exportar() {
    exportarExcel({
      products,
      priceIndex,
      purchaseItems,
      purchaseById,
      storeById,
      productById,
      shoppingItems,
      listById: new Map(lists.map((l) => [l.id, l])),
    });
    flash("Planilha exportada.");
  }

  async function importarProdutos(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    try {
      const plano = planejarImportProdutos(await arquivo.arrayBuffer(), products, categories);
      if (plano.novos.length) await repos.products.bulkCreate(plano.novos);
      for (const u of plano.atualizar) await repos.products.update(u.id, u.patch);
      flash(plano.novos.length + " incluído(s), " + plano.atualizar.length + " atualizado(s).");
    } catch (err) {
      flash("Não foi possível ler o arquivo: " + (err as Error).message);
    }
  }

  async function apagarTudo() {
    if (!window.confirm("Isto apaga TODOS os dados do app neste dispositivo. Continuar?")) return;
    if (!window.confirm("Confirma? A ação não pode ser desfeita.")) return;
    const { db } = await import("@/db/schema");
    await db.delete();
    location.reload();
  }

  async function gerarCodigoLista() {
    const lista = lists.find((l) => l.id === listaShareId);
    if (!lista) return;
    const itens = itensPorLista.get(lista.id) ?? [];
    const obj = listaParaCodigo(lista, itens, productById, storeById);
    if (!obj.i.length) {
      flash("Esta lista não tem itens pendentes para compartilhar.");
      setCodGerado("");
      return;
    }
    try {
      setCodGerado(await codificarLista(obj));
    } catch (e) {
      flash("Não foi possível gerar o código: " + (e as Error).message);
    }
  }

  async function copiarCodigo() {
    if (!codGerado) return;
    try {
      await navigator.clipboard.writeText(codGerado);
      flash("Código copiado.");
    } catch {
      flash("Não foi possível copiar — selecione e copie manualmente.");
    }
  }

  async function importarLista() {
    const texto = codImport.trim();
    if (!texto) return;
    let obj;
    try {
      obj = await decodificarLista(texto);
    } catch {
      flash("Código inválido.");
      return;
    }
    let plano;
    try {
      plano = planejarImportacao(obj, stores);
    } catch (e) {
      flash((e as Error).message);
      return;
    }

    try {
      const mapaProd = new Map(products.map((p) => [p.nameNorm || norm(p.name), p.id]));
      const listId = await repos.lists.createList({
        name: plano.nome,
        storeId: plano.storeId,
        active: 1,
        createdAt: Date.now(),
      });
      let qtd = 0;
      for (const linha of plano.itens) {
        const chave = norm(linha.nome);
        let productId = mapaProd.get(chave);
        if (!productId) {
          productId = await repos.products.create({
            name: linha.nome,
            brand: "",
            packageSize: null,
            packageUnit: "",
            category: "",
            categoryId: null,
            frequency: "30 dias",
            unit: "un",
            defaultPrice: null,
            targetPrice: null,
            barcode: null,
          });
          mapaProd.set(chave, productId);
        }
        await repos.lists.addItem({
          productId,
          quantity: linha.quantity,
          status: "A comprar",
          priority: (PRIORITIES as readonly Priority[]).includes(linha.priority as Priority)
            ? (linha.priority as Priority)
            : "Média",
          listId,
        });
        qtd++;
      }
      setCodImport("");
      flash(
        qtd +
          " item(ns) importado(s)." +
          (plano.storeId
            ? " Lista ligada ao mercado " +
              (storeById.get(plano.storeId)?.name ?? "") +
              "."
            : " A lista ficou sem mercado — escolha um no ⋯ da tela Lista, senão os itens não saem sozinhos quando você registrar a compra."),
      );
    } catch (e) {
      flash("Não foi possível importar: " + (e as Error).message);
    }
  }

  // -------------------------------------------------------------------------
  //  Render
  // -------------------------------------------------------------------------

  const backupAt = derived.backupAt;
  const backupVelho = daysSince(backupAt) == null || (daysSince(backupAt) ?? 0) >= 7;

  return (
    <div className="fade-in">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Configurações</h1>

      <Dica
        id="config"
        itens={[
          "“Orçamento mensal” define o teto usado no Início: VR/VA mais o aporte em dinheiro.",
          "“Regras de preço” ajustam a tolerância (quanto acima do alvo ainda é aceitável) e o desconto usado para sugerir alvo em produtos sem alvo próprio.",
          "Os dados ficam só neste navegador. O backup JSON é a única forma de levar a base para outro aparelho — use “Baixar backup completo” ou “Compartilhar backup”.",
          "“Restaurar backup” substitui TODOS os dados atuais pelo arquivo escolhido. Não dá para desfazer.",
          "O painel cinza mostra quando foi o último backup, o tamanho da base e se o navegador está protegendo os dados contra descarte.",
        ]}
      />

      {aviso && (
        <div className="fade-in mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {aviso}
        </div>
      )}

      {/* ---- Orçamento mensal ---- */}
      <Panel title="Orçamento mensal">
        <div className="grid grid-cols-2 gap-3">
          <label className="mb-3 block">
            <span className="mb-1 block text-sm text-gray-600">VR / VA</span>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="0.01"
              value={budget.vrva}
              onChange={(e) => setBudget((b) => ({ ...b, vrva: e.target.value }))}
            />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-sm text-gray-600">Aporte</span>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="0.01"
              value={budget.extra}
              onChange={(e) => setBudget((b) => ({ ...b, extra: e.target.value }))}
            />
          </label>
        </div>
        <p className="mb-3 text-sm text-gray-500">
          Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
            totalOrcamento,
          )}
        </p>
        <Btn onClick={salvarOrcamento}>Salvar orçamento</Btn>
      </Panel>

      {/* ---- Regras de preço ---- */}
      <Panel title="Regras de preço">
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-gray-600">Tolerância acima do alvo (%)</span>
          <input
            className={inputCls}
            type="number"
            min="0"
            max="100"
            step="1"
            value={Math.round(100 * rules.tolerance)}
            onChange={(e) =>
              setRules((r) => ({ ...r, tolerance: Number(e.target.value) / 100 }))
            }
          />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-gray-600">Desconto para alvo sugerido (%)</span>
          <input
            className={inputCls}
            type="number"
            min="0"
            max="100"
            step="1"
            value={Math.round(100 * rules.targetDiscount)}
            onChange={(e) =>
              setRules((r) => ({ ...r, targetDiscount: Number(e.target.value) / 100 }))
            }
          />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-gray-600">Dia do vencimento do VR/VA</span>
          <input
            className={inputCls}
            type="number"
            min="1"
            max="31"
            step="1"
            value={rules.vrvaExpiryDay || 30}
            onChange={(e) =>
              setRules((r) => ({
                ...r,
                vrvaExpiryDay: Math.min(31, Math.max(1, Number(e.target.value) || 30)),
              }))
            }
          />
        </label>
        <p className="mb-3 text-xs text-gray-500">
          Produtos sem preço-alvo próprio usam a média histórica menos esse desconto.
        </p>
        <Btn onClick={salvarRegras}>Salvar regras</Btn>
      </Panel>

      {/* ---- Mercados ---- */}
      <Panel title={"Mercados (" + stores.length + ")"}>
        <div className="mb-3 divide-y divide-gray-100">
          {stores.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-1.5">
              <span className="truncate pr-2 text-sm text-gray-700">{s.name}</span>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  onClick={() => void renomearMercado(s.id, s.name)}
                  aria-label="Renomear"
                  className="text-gray-300 hover:text-gray-600"
                >
                  <Icon.pencil size={14} />
                </button>
                <button
                  onClick={() => void excluirMercado(s.id)}
                  aria-label="Excluir"
                  className="text-gray-300 hover:text-red-500"
                >
                  <Icon.x size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls + " text-sm"}
            placeholder="Novo mercado"
            value={novoMercado}
            onChange={(e) => setNovoMercado(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void incluirMercado()}
          />
          <Btn onClick={incluirMercado}>Incluir</Btn>
        </div>
      </Panel>

      {/* ---- Categorias ---- */}
      <Panel title={"Categorias (" + categories.length + ")"}>
        <div className="mb-3 divide-y divide-gray-100">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <span className="truncate pr-2 text-sm text-gray-700">{c.name}</span>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  onClick={() => void renomearCategoria(c.id, c.name)}
                  aria-label="Renomear"
                  className="text-gray-300 hover:text-gray-600"
                >
                  <Icon.pencil size={14} />
                </button>
                <button
                  onClick={() => void excluirCategoria(c.id, c.name)}
                  aria-label="Excluir"
                  className="text-gray-300 hover:text-red-500"
                >
                  <Icon.x size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls + " text-sm"}
            placeholder="Nova categoria"
            value={novaCategoria}
            onChange={(e) => setNovaCategoria(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void incluirCategoria()}
          />
          <Btn onClick={incluirCategoria}>Incluir</Btn>
        </div>
      </Panel>

      {/* ---- Dados ---- */}
      <Panel title="Dados">
        <p className="mb-3 text-xs text-gray-500">
          Os dados ficam neste navegador. Limpar os dados do site apaga tudo, e cada aparelho tem
          a sua própria cópia. O backup JSON é o que leva a base de um aparelho para o outro.
        </p>
        <div className="mb-3 space-y-1.5 rounded-xl bg-gray-50 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Último backup</span>
            <span
              className={
                "text-right font-medium " + (backupVelho ? "text-amber-700" : "text-gray-700")
              }
            >
              {backupAt ? fmtWhen(backupAt) + " · " + daysSince(backupAt) + "d" : "nunca"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Tamanho da base</span>
            <span className="font-medium text-gray-700">{humanBytes(uso)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Aparelho</span>
            <span className="truncate font-medium text-gray-700">{deviceLabel()}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">Armazenamento</span>
            {protegido === true ? (
              <span className="font-medium text-emerald-700">protegido</span>
            ) : (
              <button
                onClick={protegerArmazenamento}
                className="font-medium text-amber-700 underline"
              >
                não protegido — proteger
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Btn variant="secondary" className="w-full" onClick={baixar}>
            <Icon.money size={16} />
            Baixar backup completo
          </Btn>
          {podeCompartilharBackup() && (
            <Btn variant="secondary" className="w-full" onClick={compartilhar}>
              <Icon.money size={16} />
              Compartilhar backup (Drive, e-mail…)
            </Btn>
          )}
          <FileButton onChange={restaurarArquivo} accept=".json">
            <Icon.money size={16} />
            Restaurar backup
          </FileButton>
          <Btn variant="secondary" className="w-full" onClick={exportar}>
            <Icon.money size={16} />
            Exportar para Excel
          </Btn>
          <FileButton onChange={importarProdutos} accept=".xlsx,.xls">
            <Icon.money size={16} />
            Importar produtos do Excel
          </FileButton>
          <Btn variant="danger" className="w-full" onClick={apagarTudo}>
            <Icon.trash size={16} />
            Apagar todos os dados
          </Btn>
        </div>
      </Panel>

      {/* ---- Backups automáticos ---- */}
      <Panel title="Backups automáticos">
        <p className="mb-3 text-xs text-gray-500">
          O app guarda sozinho até {AUTO_MAX} cópias, no máximo uma por dia. Elas ficam neste
          mesmo navegador e não substituem o backup baixado: se o aparelho quebrar ou você limpar
          os dados do site, elas vão junto.
        </p>
        <div className="mb-3 space-y-1.5 rounded-xl bg-gray-50 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Guardados</span>
            <span className="font-medium text-gray-700">
              {auto.quantidade} de {AUTO_MAX}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Mais recente</span>
            <span className="font-medium text-gray-700">
              {auto.maisRecente != null
                ? fmtWhen(new Date(auto.maisRecente).toISOString())
                : "nenhum"}
            </span>
          </div>
        </div>
        <Btn
          variant="secondary"
          className="w-full"
          disabled={!auto.quantidade}
          onClick={restaurarUltimoAuto}
        >
          <Icon.money size={16} />
          Restaurar o último automático
        </Btn>
      </Panel>

      {/* ---- Catálogo EAN (seção nova) ---- */}
      <EanCatalogPanel aviso={flash} />

      {/* ---- Compartilhar / importar lista por código ---- */}
      <Panel title="Compartilhar / importar lista por código">
        <p className="mb-3 text-xs text-gray-500">
          Gere um código de uma lista sua para mandar ao seu par, ou cole o código que ele
          compartilhou. Ao importar, vira uma lista nova e ativa; produtos que ainda não existem no
          catálogo são criados com o mínimo, e você completa depois em Produtos.
        </p>

        <div className="mb-4">
          <span className="mb-1 block text-sm text-gray-600">Gerar código de uma lista</span>
          <div className="flex gap-2">
            <select
              className={inputCls + " bg-white text-sm"}
              value={listaShareId}
              onChange={(e) => {
                setListaShareId(e.target.value);
                setCodGerado("");
              }}
            >
              <option value="">Escolha uma lista…</option>
              {listasAtivas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Btn disabled={!listaShareId} onClick={gerarCodigoLista}>
              Gerar
            </Btn>
          </div>
          {codGerado && (
            <div className="mt-2">
              <textarea
                readOnly
                className={inputCls + " h-20 font-mono text-xs"}
                aria-label="Código gerado"
                value={codGerado}
              />
              <Btn variant="secondary" className="mt-2 w-full" onClick={copiarCodigo}>
                Copiar código
              </Btn>
            </div>
          )}
        </div>

        <span className="mb-1 block text-sm text-gray-600">Importar de um código</span>
        <textarea
          className={inputCls + " mb-3 h-24 font-mono text-xs"}
          aria-label="Código da lista"
          placeholder="MDC1:…"
          value={codImport}
          onChange={(e) => setCodImport(e.target.value)}
        />
        <Btn className="w-full" disabled={!codImport.trim()} onClick={importarLista}>
          <Icon.money size={16} />
          Importar
        </Btn>
      </Panel>
    </div>
  );
}
