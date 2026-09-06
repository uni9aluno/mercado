# Guia de porte das telas (Fase 4)

Você está portando UMA tela do `MercadoDoCasal.html` (app single-file, React sem JSX,
minificado) para o projeto Vite + React 18 + TypeScript deste diretório (`app/`).

## Regras

1. **Porte 1:1 o comportamento.** Mesmos cálculos, mesmos textos em português, mesma
   estrutura de tela. O código-fonte original da sua tela está em
   `<scratchpad>/screens/<Nome>.js` (minificado — leia com cuidado, nomes de 1 letra).
2. **Use a camada pronta, não reinvente:**
   - Tipos: `@/db/types` (`Product`, `Purchase`, `PurchaseItem`, `ShoppingList`,
     `ShoppingItem`, `Store`, `Category`, `Id` = string uid, `LEGACY_PRODUCT_ID`).
   - Dados (LEITURA): hooks de `@/hooks/useData` (`useProducts`, `useStores`,
     `useCategories`, `usePurchases`, `usePurchaseItems`, `useLists`,
     `useShoppingItems`, `useSetting<T>(key)`). São live (dexie-react-hooks) — a tela
     re-renderiza sozinha quando o banco muda. **Nunca** chame `reload()`.
   - Dados (ESCRITA): `import { repos } from "@/data"` — `repos.products.create/update/
     remove/bulkCreate`, `repos.lists.*`, `repos.purchases.create`, `repos.settings.put/
     remove`, `repos.stores.*`, `repos.categories.*`. Ver as interfaces em
     `@/data/types.ts`.
   - Preços: `@/hooks/usePriceIndex` devolve `{ priceIndex, purchaseById }`.
     `@/domain/priceIndex` tem `priceFor`, `effectiveTarget`, `light`, `LIGHT_CLASS`,
     `LIGHT_DOT`, `baseContent`.
   - Lookups: `@/hooks/useMaps` devolve `productById`, `storeById`, `categoryById`.
   - Derivados globais: `@/hooks` → `useDerived()` dá `{ budget (com .total),
     rules (defaults preenchidos), activeListIds, activeListId, backupAt }`.
   - Listas: `@/hooks` → `useShoppingByList()` dá `{ shoppingByList (Map
     listId→itens), listById, activeLists, inactiveLists }`.
   - Compras: `@/hooks` → `usePurchaseData()` dá `{ purchaseById, itemsByPurchase
     (Map purchaseId→itens), historicoByProduct (Map productId→datas) }`.
   - Domínio: `@/domain/forecast` (previsão), `@/domain/compare` (comparador),
     `@/domain/budget` (orçamento), `@/domain/backup`, `@/domain/purchase`
     (`registrarCompra`), `@/domain/barcode`.
   - Componentes: `@/ui` — `Btn`, `Input`, `Select`, `Field`, `Modal`, `Dica`, `Stat`,
     `MiniStat`, `Empty`, `Thumb`, `SearchBox`, `UndoBar`, `PriceSpark`,
     `ProductPicker`, `SwipeRow`, `Boundary`, `Icon` (objeto: `Icon.home`, `Icon.cart`…).
   - Texto/formato: `@/lib/text` (`BRL`, `fmt`, `fmtPct`, `today`, `brDate`, `norm`,
     `daysSince`, `agoraBr`, `capitalize`). Constantes: `@/lib/constants`
     (`PAYMENT_METHODS`, `PURCHASE_TYPES`, `BUYERS`, `BUYER_LABEL`, `RATING_LABEL`,
     `FREQUENCIES`, `PRIORITIES`, `UNITS`, `PKG_UNITS`, `FREQ_DAYS`, `DIA_MS`,
     `JANELA_90`, `CALENDAR_COLORS`, `COR_PREVISAO`).
   - Undo: `@/lib/undo` (`undoPush(label, fn)`).
3. **IDs são strings (uid).** No original eram números. `Number(r)` vira só `r`.
   `productId: 0` legacy vira `LEGACY_PRODUCT_ID` (`"0"`). `storeId` pode ser `null`.
   `active` é `0`/`1` (nunca boolean).
4. **JSX de verdade** (não `React.createElement`). TypeScript estrito
   (`noUnusedLocals`, `strict`). Sem `any` — se precisar, comente o porquê.
5. **Tailwind via PostCSS** — todas as classes disponíveis, sem auditoria manual.
   Classes utilitárias fora do padrão: escreva no `src/styles/index.css`.
6. **Melhorias de UI permitidas** (dentro do estilo atual): espaçamento/tipografia
   consistentes, hierarquia visual mais clara, `Thumb` (foto) onde fizer sentido.
   **Proibido:** mudar o modelo de dados, esconder função que existe hoje, redesenhar.
7. **A tela é um named export** com o nome que `src/routes.tsx` importa
   (`export function Dashboard() {…}`). Substitua o stub em `src/features/<pasta>/`.
8. Componentes auxiliares da sua tela (ex.: `ProductForm` para Produtos) podem morar
   no mesmo diretório da feature.

## Verificação (você MESMO roda antes de entregar)

```bash
cd app && NODE_EXTRA_CA_CERTS="X:/Mercado/app/.corp-ca.pem" npx tsc -b
cd app && NODE_EXTRA_CA_CERTS="X:/Mercado/app/.corp-ca.pem" npx eslint src --ext ts,tsx
```

Ambos devem passar limpos. Se sua tela tem lógica nova não coberta pelo `domain/`,
escreva um teste Vitest (`*.test.ts`) ao lado.

## Bug conhecido a NÃO replicar

O `Compare` original tem `limite90` indefinido no `useMemo` de "Perfil dos mercados"
— já corrigido em `@/domain/compare.ts` (`buildPerfilMercados`). Use a função pronta.
