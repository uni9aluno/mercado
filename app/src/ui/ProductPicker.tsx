import { useMemo, useState } from "react";
import { useDebounced } from "@/hooks/useDebounced";
import { norm } from "@/lib/text";
import { fmt } from "@/lib/text";
import { priceFor, type PriceEntry } from "@/domain/priceIndex";
import { PRIORITIES } from "@/lib/constants";
import type { Priority, Product } from "@/db/types";
import { Btn } from "./Btn";
import { Input, Select } from "./Field";
import { SearchBox } from "./SearchBox";
import { Thumb } from "./Thumb";

interface Props {
  products: Product[];
  priceIndex: Map<string, PriceEntry>;
  /** instant: adiciona direto (qty 1, sem prioridade). Senão pede qtd/prioridade. */
  instant?: boolean;
  onAdd: (productId: string, quantity: number, priority: Priority | null) => void;
}

export function ProductPicker({ products, priceIndex, instant, onAdd }: Props) {
  const [busca, setBusca] = useState("");
  const buscaDeb = useDebounced(busca, 150);
  const [escolhido, setEscolhido] = useState<Product | null>(null);
  const [qtd, setQtd] = useState("1");
  const [prioridade, setPrioridade] = useState<Priority>("Média");

  const lista = useMemo(() => {
    const t = norm(buscaDeb);
    const out: Product[] = [];
    for (const p of products) {
      if (!t || (p.nameNorm || norm(p.name)).includes(t)) {
        out.push(p);
        if (out.length >= 40) break;
      }
    }
    return out;
  }, [products, buscaDeb]);

  if (escolhido && !instant) {
    return (
      <div>
        <div className="mb-1 font-medium text-gray-900">{escolhido.name}</div>
        <div className="mb-3 text-sm text-gray-500">
          {fmt(priceFor(escolhido, priceIndex.get(escolhido.id)))} / {escolhido.unit}
        </div>
        <Input
          label="Quantidade"
          type="number"
          min="0.01"
          step="any"
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          autoFocus
        />
        <Select
          label="Prioridade"
          options={PRIORITIES}
          value={prioridade}
          onChange={(e) => setPrioridade(e.target.value as Priority)}
        />
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setEscolhido(null)}>
            Voltar
          </Btn>
          <Btn className="flex-1" onClick={() => onAdd(escolhido.id, Number(qtd) || 1, prioridade)}>
            Adicionar
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar produto" />
      </div>
      <div className="max-h-72 divide-y divide-gray-100 overflow-auto">
        {lista.map((p) => (
          <button
            key={p.id}
            onClick={() => (instant ? onAdd(p.id, 1, null) : setEscolhido(p))}
            className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-gray-50"
          >
            <Thumb src={p.image} nome={p.name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-gray-900">{p.name}</span>
              <span className="block text-xs text-gray-400">
                {fmt(priceFor(p, priceIndex.get(p.id)))} / {p.unit}
              </span>
            </span>
          </button>
        ))}
        {lista.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">Nenhum produto encontrado.</p>
        )}
      </div>
    </div>
  );
}
