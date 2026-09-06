// Tela Produtos — portada 1:1 de MercadoDoCasal.html (linha 361).
//
// Catálogo que alimenta listas e Comparador: busca + filtro por categoria,
// agrupamento por categoria, semáforo de preço na bolinha, criar/editar/excluir.

import { useMemo, useState } from "react";
import {
  useCategories,
  useDebounced,
  useDerived,
  usePriceIndex,
  useProducts,
  useShoppingItems,
} from "@/hooks";
import { repos } from "@/data";
import {
  baseContent,
  effectiveTarget,
  light,
  LIGHT_DOT,
  priceFor,
} from "@/domain/priceIndex";
import { Btn, Dica, Empty, Icon, Modal, SearchBox, Thumb } from "@/ui";
import { fmt, norm } from "@/lib/text";
import type { Product } from "@/db/types";
import { ProductForm } from "./ProductForm";

export function Products() {
  const products = useProducts();
  const categories = useCategories();
  const { priceIndex } = usePriceIndex();
  const { rules } = useDerived();
  const shoppingItems = useShoppingItems();

  const [busca, setBusca] = useState("");
  const buscaAtrasada = useDebounced(busca, 180);
  const [categoria, setCategoria] = useState("");
  const [editando, setEditando] = useState<Product | null>(null);
  const [aberto, setAberto] = useState(false);

  // grupos por categoria, ordenados; produtos ordenados por nome (pt-BR).
  const grupos = useMemo(() => {
    const alvo = norm(buscaAtrasada);
    const mapa = new Map<string, Product[]>();
    for (const p of products) {
      if (categoria && p.category !== categoria) continue;
      if (alvo && !(p.nameNorm || norm(p.name)).includes(alvo)) continue;
      const chave = p.category || "Sem categoria";
      const arr = mapa.get(chave) ?? [];
      arr.push(p);
      mapa.set(chave, arr);
    }
    for (const arr of mapa.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [products, buscaAtrasada, categoria]);

  const total = grupos.reduce((n, [, arr]) => n + arr.length, 0);

  function abrirNovo() {
    setEditando(null);
    setAberto(true);
  }
  function abrirEdicao(p: Product) {
    setEditando(p);
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    setEditando(null);
  }

  async function salvar(saved: Product) {
    const { id: _id, ...campos } = saved;
    if (editando) {
      await repos.products.update(editando.id, campos);
    } else {
      await repos.products.create(campos);
    }
    fechar();
  }

  async function excluir() {
    if (!editando) return;
    if (!confirm("Excluir este produto? O histórico de compras dele é mantido.")) return;
    const pid = editando.id;
    await repos.products.remove(pid);
    const orfaos = shoppingItems.filter((it) => it.productId === pid).map((it) => it.id);
    if (orfaos.length) await repos.lists.bulkRemoveItems(orfaos);
    fechar();
  }

  return (
    <div className="fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        <Btn onClick={abrirNovo}>
          <Icon.plus size={16} />
          Novo
        </Btn>
      </div>

      <Dica
        id="produtos"
        itens={[
          "Este é o catálogo que alimenta as listas e o comparador. “Novo” cadastra um produto; tocar num produto existente abre a edição.",
          "A busca e o seletor de categoria ao lado filtram o catálogo, que fica agrupado por categoria.",
          "A bolinha à esquerda é o semáforo de preço: verde dentro do alvo, amarelo na tolerância, vermelho acima.",
          "A “frequência” é a cada quantos dias o produto costuma acabar — é ela que faz o produto aparecer em “Hora de repor”, no Início.",
          "Excluir um produto tira ele das listas, mas o histórico de compras dele é mantido.",
        ]}
      />

      <div className="mb-3 flex gap-2">
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar produto" />
        <select
          className="max-w-[40%] rounded-lg border border-gray-300 bg-white px-2 text-sm"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-xs text-gray-400">{total} produto(s)</p>

      {total === 0 && <Empty>Nada encontrado com esse filtro.</Empty>}

      {grupos.map(([cat, arr]) => (
        <section key={cat} className="mb-4">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {cat}
          </h2>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {arr.map((p) => {
              const entry = priceIndex.get(p.id);
              const preco = priceFor(p, entry);
              const alvo = effectiveTarget(p, entry, rules.targetDiscount);
              const farol = light(preco, alvo, rules.tolerance);
              const base = baseContent(p);
              const porUnidade =
                base && preco != null
                  ? " · " +
                    fmt(preco / base) +
                    "/" +
                    (p.packageUnit === "ml" || p.packageUnit === "L" ? "L" : "kg")
                  : "";
              return (
                <button
                  key={p.id}
                  onClick={() => abrirEdicao(p)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span
                    className={"h-2 w-2 flex-shrink-0 rounded-full " + LIGHT_DOT[farol]}
                  />
                  <Thumb src={p.image} nome={p.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{p.name}</div>
                    <div className="truncate text-xs text-gray-500">
                      {p.brand ? p.brand + " · " : ""}
                      {p.unit} · {p.frequency}
                      {porUnidade}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-semibold text-gray-900">{fmt(preco)}</div>
                    {alvo != null && (
                      <div className="text-xs text-gray-400">alvo {fmt(alvo)}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <Modal
        open={aberto}
        onClose={fechar}
        title={editando ? "Editar produto" : "Novo produto"}
      >
        <ProductForm
          key={editando ? editando.id : "novo"}
          product={editando ?? undefined}
          onSave={salvar}
          onDelete={editando ? excluir : undefined}
        />
      </Modal>
    </div>
  );
}
