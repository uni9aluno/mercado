import { db } from "./schema";
import { norm } from "@/lib/text";
import {
  LEGACY_PRODUCT_ID,
  type Frequency,
  type PackageUnit,
  type ProductRow,
} from "./types";

// ===========================================================================
//  SEED — dados iniciais transcritos do MercadoDoCasal.html (linha 361).
//  Os arrays SEED_PRODUCTS / SEED_HISTORY foram extraídos verbatim do literal
//  minificado (script scratchpad/extract-seeds.mjs), não retranscritos à mão.
//
//  Cada registro é criado já com `uid` (UUID). A PK numérica (`++id`) fica por
//  conta do Dexie.
// ===========================================================================

export const SEED_CATEGORIES = [
  "Açougue & Proteínas",
  "Hortifrúti",
  "Despensa, Temperos & Matinais",
  "Laticínio & Frios",
  "Higiene & Limpeza",
  "Lazer Gastronômico",
] as const;

export const SEED_STORES = [
  "Atacadão / Rota de Proteínas",
  "Feira Livre de Bairro",
  "Supermercado Local",
  "Sacolão / Hortifrúti",
  "Empório / Adega",
  "Atacarejo",
  "Farmácia",
  "Outro",
] as const;

const CAT_FALLBACK = "Despensa, Temperos & Matinais";

interface SeedProduct {
  n: string;
  b: string;
  ps: number | null;
  pu: string;
  c: string;
  f: string;
  u: string;
  dp: number | null;
  tp: number | null;
}

export const SEED_PRODUCTS: SeedProduct[] = [
  { n: "Acém Moído", b: "", ps: null, pu: "kg", c: "Açougue & Proteínas", f: "30 dias", u: "kg", dp: 40, tp: null },
  { n: "Acém em peça", b: "", ps: null, pu: "kg", c: "Açougue & Proteínas", f: "30 dias", u: "kg", dp: 40, tp: null },
  { n: "Bacon", b: "", ps: null, pu: "kg", c: "Açougue & Proteínas", f: "30 dias", u: "kg", dp: 20, tp: null },
  { n: "Coxão Mole", b: "", ps: null, pu: "kg", c: "Açougue & Proteínas", f: "30 dias", u: "kg", dp: 23, tp: null },
  { n: "Linguiça Calabresa", b: "", ps: null, pu: "kg", c: "Açougue & Proteínas", f: "30 dias", u: "kg", dp: 20, tp: null },
  { n: "Linguiça Toscana", b: "Sádia / Aurora", ps: null, pu: "kg", c: "Açougue & Proteínas", f: "30 dias", u: "kg", dp: 23, tp: null },
  { n: "Osso Buco (Kira)", b: "", ps: null, pu: "kg", c: "Açougue & Proteínas", f: "30 dias", u: "kg", dp: 23, tp: null },
  { n: "Ovos (cartela 30 un)", b: "Caipira", ps: null, pu: "un", c: "Açougue & Proteínas", f: "30 dias", u: "cartela", dp: 17, tp: null },
  { n: "Peito de frango S/ Osso", b: "", ps: null, pu: "kg", c: "Açougue & Proteínas", f: "30 dias", u: "kg", dp: 20, tp: null },
  { n: "Absorvente", b: "Sempre Livre", ps: 8, pu: "un", c: "Higiene & Limpeza", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Agua de Coco", b: "Só Coco", ps: 1, pu: "L", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "caixa", dp: 12, tp: null },
  { n: "Alho em Pó (50g)", b: "", ps: 100, pu: "g", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Arroz (5 kg)", b: "Premium Solito", ps: 5, pu: "kg", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: 22, tp: null },
  { n: "Azeite de oliva extra virgem (500ml)", b: "", ps: 500, pu: "ml", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "garrafa", dp: 42, tp: null },
  { n: "Açucar (1 Kg)", b: "", ps: 1, pu: "kg", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 5, tp: null },
  { n: "Bicarbonato de sódio (100g)", b: "", ps: 100, pu: "g", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 4, tp: null },
  { n: "Café Pilão vácuo (500g)", b: "Pilão", ps: 500, pu: "g", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: 32, tp: null },
  { n: "Café solúvel (100g)", b: "Pilão", ps: 100, pu: "g", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pote", dp: 12, tp: null },
  { n: "Chimichurri (30g)", b: "", ps: 100, pu: "g", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 5, tp: null },
  { n: "Creme de Leite", b: "", ps: 470, pu: "ml", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Enxaguante Bucal", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Esponja de Aço", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Esponja para louça", b: "", ps: null, pu: "un", c: "Higiene & Limpeza", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Extrato de Tomate", b: "", ps: null, pu: "un", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: 8, tp: null },
  { n: "Farinha de rosca", b: "", ps: null, pu: "g", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Farinha de trigo tipo 1 (1 kg)", b: "", ps: 1, pu: "kg", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "kg", dp: 5.5, tp: null },
  { n: "Feijão carioca (1 kg)", b: "", ps: 1, pu: "kg", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: 8.5, tp: null },
  { n: "Feijão preto (1 kg)", b: "", ps: 1, pu: "kg", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: 8.5, tp: null },
  { n: "Fermento biológico seco (100g)", b: "", ps: 100, pu: "g", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: 9, tp: null },
  { n: "Katchup", b: "", ps: 750, pu: "ml", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Leite em pó integral (400g)", b: "", ps: 400, pu: "g", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "lata", dp: 16, tp: null },
  { n: "Louro em folhas (20g)", b: "", ps: 20, pu: "g", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 4, tp: null },
  { n: "Macarrão", b: "", ps: 500, pu: "g", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: 9, tp: null },
  { n: "Maionese", b: "", ps: 200, pu: "ml", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Miojo", b: "", ps: null, pu: "un", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 2.6, tp: null },
  { n: "Mostarda", b: "", ps: null, pu: "un", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Ovomaltine crocante (300g)", b: "", ps: null, pu: "un", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: 14, tp: null },
  { n: "Paste de dente", b: "", ps: null, pu: "un", c: "Higiene & Limpeza", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Pimenta-do-reino em pó/grão (50g)", b: "", ps: null, pu: "g", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6.5, tp: null },
  { n: "Páprica doce/defumada (50g)", b: "", ps: null, pu: "g", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 7, tp: null },
  { n: "Pão de forma", b: "", ps: null, pu: "un", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Saco Plastico freezer", b: "", ps: null, pu: "un", c: "Higiene & Limpeza", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Sal Grosso", b: "", ps: null, pu: "kg", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Sal refinado (1 kg)", b: "", ps: null, pu: "kg", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "kg", dp: 3, tp: null },
  { n: "Tempero Ana Maria (50g)", b: "", ps: null, pu: "g", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 6, tp: null },
  { n: "Tomate pelado em lata (400g)", b: "", ps: null, pu: "g", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "lata", dp: 7.5, tp: null },
  { n: "Vinagre de alcool/maçã (750ml)", b: "", ps: null, pu: "ml", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "garrafa", dp: 5.5, tp: null },
  { n: "Óleo de soja (900ml)", b: "", ps: null, pu: "ml", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "garrafa", dp: 7.5, tp: null },
  { n: "Agua Sanitária", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: 12, tp: null },
  { n: "Alcool em Gel", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: 12, tp: null },
  { n: "Amaciante concentrado (1.5L)", b: "Downy", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: 24, tp: null },
  { n: "Desengordurante", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: 12, tp: null },
  { n: "Desifetante - Lavanda e Malaleuca", b: "Pinho Sol", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: 14, tp: null },
  { n: "Detergente concentrado (500ml)", b: "Ypê", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: 3.2, tp: null },
  { n: "Papel higiênico folha dupla (16 un)", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "pacote", dp: 28, tp: null },
  { n: "Papel-toalha (2 un)", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "pacote", dp: 12, tp: null },
  { n: "Sabone Liquido", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: 12, tp: null },
  { n: "Sabonete em Barra", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "pacote", dp: 12, tp: null },
  { n: "Sabão líquido Omo (3L)", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: 38, tp: null },
  { n: "Alho", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "30 dias", u: "kg", dp: 35, tp: null },
  { n: "Banana Nanica", b: "", ps: null, pu: "dúzia", c: "Hortifrúti", f: "15 dias", u: "dúzia", dp: 8, tp: null },
  { n: "Batata", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 6, tp: null },
  { n: "Beterraba", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 6, tp: null },
  { n: "Brocolis", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 6, tp: null },
  { n: "Cebola", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 6, tp: null },
  { n: "Cenoura", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 5.5, tp: null },
  { n: "Cheiro-verde", b: "", ps: null, pu: "maço", c: "Hortifrúti", f: "15 dias", u: "maço", dp: 3, tp: null },
  { n: "Couve", b: "", ps: null, pu: "maço", c: "Hortifrúti", f: "15 dias", u: "maço", dp: 4, tp: null },
  { n: "Espinafre", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 4.5, tp: null },
  { n: "Laranja", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 4.5, tp: null },
  { n: "Limão", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "un", dp: 6, tp: null },
  { n: "Maçã", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 9, tp: null },
  { n: "Repolho", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "pé", dp: 3.5, tp: null },
  { n: "Tomate italiano maduro", b: "", ps: null, pu: "kg", c: "Hortifrúti", f: "15 dias", u: "kg", dp: 8, tp: null },
  { n: "Uva Thompson", b: "", ps: null, pu: "un", c: "Hortifrúti", f: "15 dias", u: "caixa", dp: 11, tp: null },
  { n: "Iogurte natural integral (170g)", b: "", ps: null, pu: "", c: "Laticínio & Frios", f: "15 dias", u: "pote", dp: 3.8, tp: null },
  { n: "Leite integral (1L)", b: "", ps: null, pu: "", c: "Laticínio & Frios", f: "30 dias", u: "litro", dp: 5.5, tp: null },
  { n: "Manteiga com sal (200g)", b: "", ps: null, pu: "", c: "Laticínio & Frios", f: "30 dias", u: "pote", dp: 12.5, tp: null },
  { n: "Queijo muçarela", b: "", ps: null, pu: "", c: "Laticínio & Frios", f: "30 dias", u: "kg", dp: 48, tp: null },
  { n: "Queijo parmesão", b: "", ps: null, pu: "", c: "Laticínio & Frios", f: "30 dias", u: "kg", dp: 93.33, tp: null },
  { n: "Barra de chocolate ao leite (80g)", b: "", ps: null, pu: "", c: "Lazer Gastronômico", f: "30 dias", u: "barra", dp: 6, tp: null },
  { n: "Bolacha / Biscoito recheado (130g)", b: "", ps: null, pu: "", c: "Lazer Gastronômico", f: "30 dias", u: "pacote", dp: 3.5, tp: null },
  { n: "Cacau em pó  (80g)", b: "", ps: null, pu: "", c: "Lazer Gastronômico", f: "30 dias", u: "barra", dp: 9, tp: null },
  { n: "Milho", b: "", ps: null, pu: "", c: "Lazer Gastronômico", f: "30 dias", u: "pacote", dp: 7, tp: null },
  { n: "Refrigerante Zero 2L", b: "", ps: null, pu: "", c: "Lazer Gastronômico", f: "30 dias", u: "garrafa", dp: 38, tp: null },
  { n: "Filtro de Papel", b: "Melita", ps: null, pu: "un", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: 3, tp: null },
  { n: "Açucar Mascavo", b: "", ps: null, pu: "", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "pacote", dp: null, tp: null },
  { n: "Massa para pizza", b: "", ps: null, pu: "", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: null, tp: null },
  { n: "Massa de pastel", b: "", ps: null, pu: "", c: "Despensa, Temperos & Matinais", f: "30 dias", u: "pacote", dp: null, tp: null },
  { n: "Essencia de baunilha", b: "", ps: null, pu: "", c: "Despensa, Temperos & Matinais", f: "60 dias", u: "frasco", dp: null, tp: null },
  { n: "Shampoo", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: null, tp: null },
  { n: "Condicionador", b: "", ps: null, pu: "", c: "Higiene & Limpeza", f: "30 dias", u: "frasco", dp: null, tp: null },
];

interface SeedHistory {
  date: string;
  store: string;
  product: string;
  category: string;
  qty: number;
  price: number;
  payment: string;
  type: string;
  notes: string;
}

export const SEED_HISTORY: SeedHistory[] = [
  { date: "2026-08-02", store: "Atacadão / Rota de Proteínas", product: "Compra consolidada", category: "Açougue & Proteínas", qty: 1, price: 300, payment: "VR / VA", type: "Planejada", notes: "Benefício VR/VA aplicado para proteínas" },
  { date: "2026-08-02", store: "Atacadão / Rota de Proteínas", product: "Compra consolidada", category: "Açougue & Proteínas", qty: 1, price: 125, payment: "Cartão de Débito", type: "Planejada", notes: "Complemento pago no débito" },
  { date: "2026-08-05", store: "Feira Livre de Bairro", product: "Compra consolidada", category: "Hortifrúti", qty: 1, price: 105, payment: "PIX", type: "Planejada", notes: "Feira de final da feira" },
  { date: "2026-08-10", store: "Supermercado Local", product: "Compra consolidada", category: "Despensa, Temperos & Matinais", qty: 1, price: 380, payment: "Cartão de Crédito", type: "Planejada", notes: "Grãos, matinais, cafés e temperos" },
  { date: "2026-08-18", store: "Sacolão / Hortifrúti", product: "Compra consolidada", category: "Hortifrúti", qty: 1, price: 110, payment: "PIX", type: "Planejada", notes: "Reposição quinzenal" },
  { date: "2026-08-22", store: "Empório / Adega", product: "Compra consolidada", category: "Lazer Gastronômico", qty: 1, price: 135, payment: "Cartão de Débito", type: "Planejada", notes: "Vinhos e chocolates para date night" },
];

function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Popula o banco só se estiver vazio (guard: `products.count() > 0`).
 * Mesma ordem do original: categories → stores → products → purchases →
 * purchaseItems → settings → 1 lista ativa.
 */
export async function seedIfEmpty(): Promise<void> {
  if ((await db.products.count()) > 0) return;

  await db.transaction(
    "rw",
    [
      db.categories,
      db.stores,
      db.products,
      db.purchases,
      db.purchaseItems,
      db.shoppingLists,
      db.settings,
    ],
    async () => {
      // 1. categorias
      const mapaCat: Record<string, string> = {};
      await db.categories.bulkAdd(
        SEED_CATEGORIES.map((name) => {
          const u = uuid();
          mapaCat[name] = u;
          return { uid: u, name };
        }),
      );

      // 2. mercados
      const mapaStore: Record<string, string> = {};
      await db.stores.bulkAdd(
        SEED_STORES.map((name) => {
          const u = uuid();
          mapaStore[name] = u;
          return { uid: u, name };
        }),
      );

      // 3. produtos
      await db.products.bulkAdd(
        SEED_PRODUCTS.map((e): ProductRow => {
          const category = e.c || CAT_FALLBACK;
          return {
            uid: uuid(),
            name: e.n,
            nameNorm: norm(e.n),
            brand: e.b || "",
            packageSize: e.ps,
            packageUnit: (e.pu || "") as PackageUnit | "",
            category,
            categoryId: mapaCat[e.c] || mapaCat[CAT_FALLBACK],
            frequency: (e.f || "30 dias") as Frequency,
            unit: e.u || "un",
            defaultPrice: e.dp,
            targetPrice: e.tp,
            barcode: null,
            preferredStoreId: null,
            comparisonGroup: null,
            image: null,
          };
        }),
      );

      // 4. compras consolidadas (legacy)
      const compras = SEED_HISTORY.map((h) => ({
        uid: uuid(),
        date: h.date,
        storeId: mapaStore[h.store] ?? null,
        storeName: h.store,
        paymentMethod: h.payment,
        purchaseType: h.type,
        notes: h.notes,
        legacy: 1 as const,
        total: h.price,
      }));
      await db.purchases.bulkAdd(compras);

      // 5. itens das compras consolidadas (productId sentinela)
      await db.purchaseItems.bulkAdd(
        compras.map((c, i) => {
          const h = SEED_HISTORY[i];
          return {
            uid: uuid(),
            purchaseId: c.uid,
            productId: LEGACY_PRODUCT_ID,
            productName: h.product,
            category: h.category,
            quantity: h.qty,
            unitPrice: h.price,
            total: h.price,
            legacy: 1 as const,
          };
        }),
      );

      // 6. settings
      await db.settings.bulkPut([
        { key: "budget", vrva: 300, extra: 1000 },
        { key: "rules", tolerance: 0.1, savingsGoal: 100, targetDiscount: 0.05 },
      ]);

      // 7. lista ativa inicial
      await db.shoppingLists.add({
        uid: uuid(),
        name: "Lista – Supermercado Local",
        storeId: mapaStore["Supermercado Local"] ?? null,
        active: 1,
        createdAt: Date.now(),
      });
    },
  );
}

/**
 * Rede de segurança: adota qualquer shoppingItem com listId nulo ou apontando
 * para lista inexistente. Roda no boot e ao fim de todo restore.
 */
export async function ensureListForOrphans(): Promise<void> {
  const listas = await db.shoppingLists.toArray();
  const uids = new Set(listas.map((q) => q.uid));
  const orfaos = await db.shoppingItems
    .filter((q) => q.listId == null || !uids.has(q.listId))
    .toArray();
  if (!orfaos.length) return;

  const alvo = listas.find((q) => q.active) || listas[0];
  let listUid: string;
  if (alvo) {
    listUid = alvo.uid;
  } else {
    listUid = uuid();
    await db.shoppingLists.add({
      uid: listUid,
      name: "Minha lista",
      storeId: null,
      active: 1,
      createdAt: Date.now(),
    });
  }
  await db.shoppingItems.bulkPut(orfaos.map((q) => ({ ...q, listId: listUid })));
}
