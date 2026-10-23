import { useEffect, useMemo, useState } from "react";
import { repos } from "@/data";
import { chaveProduto, produtoDoItem, type ItemCatalogo } from "@/domain/sharedCatalog";
import { useCategories, useDebounced, useProducts } from "@/hooks";
import { buscarCatalogo, LIMITE_BUSCA } from "@/integrations/sharedCatalog";
import { Btn, Modal, SearchBox } from "@/ui";

/**
 * "Catálogo de todos": produtos publicados por qualquer conta. Adicionar copia
 * o item para os produtos desta conta (sem preços); a partir daí ele é só seu.
 */
export function SharedCatalogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useProducts();
  const categories = useCategories();
  const [busca, setBusca] = useState("");
  const termo = useDebounced(busca, 300);
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [adicionados, setAdicionados] = useState<Set<string>>(new Set());

  const meus = useMemo(() => new Set(products.map((p) => chaveProduto(p))), [products]);

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    buscarCatalogo(termo)
      .then((r) => vivo && setItens(r))
      .catch(
        (e: Error) =>
          vivo &&
          setErro(
            navigator.onLine === false ? "Sem conexão." : "Não foi possível carregar: " + e.message,
          ),
      )
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [open, termo]);

  async function adicionar(item: ItemCatalogo) {
    await repos.products.create(produtoDoItem(item, categories));
    setAdicionados((s) => new Set(s).add(item.chave));
  }

  const tamanho = (i: ItemCatalogo) =>
    i.package_size ? i.package_size + (i.package_unit ? " " + i.package_unit : "") : "";

  return (
    <Modal open={open} onClose={onClose} title="Catálogo de todos" wide>
      <p className="mb-3 text-xs text-gray-500">
        Produtos publicados por todos os usuários do app. Ao adicionar, o produto é copiado para os
        seus, sem preços; depois você ajusta preço, alvo e frequência como quiser.
      </p>
      <div className="mb-3">
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar no catálogo" />
      </div>

      {erro && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{erro}</p>}
      {carregando && !itens.length && (
        <p className="py-6 text-center text-sm text-gray-400">Carregando…</p>
      )}
      {!carregando && !erro && !itens.length && (
        <p className="py-6 text-center text-sm text-gray-400">
          {termo ? "Nada encontrado." : "O catálogo ainda está vazio."}
        </p>
      )}

      <ul className="divide-y divide-gray-100">
        {itens.map((i) => {
          const jaTem = meus.has(i.chave) || adicionados.has(i.chave);
          return (
            <li key={i.chave} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">{i.name}</div>
                <div className="truncate text-xs text-gray-500">
                  {[i.brand, tamanho(i), i.category].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <Btn
                variant={jaTem ? "secondary" : "primary"}
                disabled={jaTem}
                onClick={() => void adicionar(i)}
                className="shrink-0"
              >
                {jaTem ? "Já está nos seus" : "Adicionar"}
              </Btn>
            </li>
          );
        })}
      </ul>
      {itens.length === LIMITE_BUSCA && (
        <p className="mt-2 text-center text-xs text-gray-400">
          Mostrando os {LIMITE_BUSCA} primeiros. Refine a busca para ver outros.
        </p>
      )}
    </Modal>
  );
}
