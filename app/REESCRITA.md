# Reescrita do Mercado do Casal — estado e plano

Documento vivo. Acompanha a migração do app single-file (`../MercadoDoCasal.html`)
para este projeto Vite. A seção "Onde estamos" é sempre a mais atual.

## Por que

O app nasceu como **um arquivo HTML de 1,5 MB**: todo o React (sem JSX, ~30
componentes) minificado numa linha, Tailwind pré-compilado à mão, bibliotecas
inline, zero build. Ótimo para distribuir por `file://`, péssimo para evoluir —
cada mudança era um patch por string âncora num blob minificado.

Agora o código está no GitHub e vai usar Supabase. Decisão do dono: **migrar para
um projeto Vite de verdade** (build, módulos, JSX, TypeScript, testes) e, na mesma
leva, entregar as duas funcionalidades que já queria:

1. **Modo Compra** — fluxo guiado "fazer a compra" a partir de uma lista.
2. **Catálogo de EAN online** — ao escanear um código desconhecido, buscar
   nome/marca/peso/foto numa base Supabase compartilhada, com Open Food Facts
   de reserva.

E aproveitar para melhorar a UI, preservando 100% dos dados que já existem no
IndexedDB dos aparelhos.

## Stack

Vite + React 18 + TypeScript + Tailwind (via PostCSS) + Dexie 4 +
`dexie-react-hooks`. PWA via `vite-plugin-pwa` (Workbox). Testes em Vitest.
Publicação: GitHub Actions → GitHub Pages, mesma URL de hoje
(`uni9aluno.github.io/mercado/`).

## Arquitetura

```
app/
├─ src/
│  ├─ db/          schema Dexie (v1-5), migrações, seed, tipos
│  ├─ data/        CAMADA REPOSITORY — telas falam só com isto, nunca com Dexie
│  │              (hoje: impl. dexie/*; amanhã: supabase/* pelo mesmo contrato)
│  ├─ domain/      lógica de negócio PURA (sem React, sem Dexie) — toda testada
│  ├─ hooks/       useProducts/useLists/... sobre useLiveQuery + repos
│  ├─ ui/          componentes compartilhados (Modal, Btn, Thumb, PriceSpark...)
│  ├─ features/    uma pasta por tela + buy-mode/ + barcode/ + search/
│  ├─ integrations/ eanCatalog.ts (Supabase REST + Open Food Facts), image.ts
│  └─ lib/         fmt, datas, norm, undo, constantes
└─ src/**/*.test.ts   Vitest
```

O ponto-chave é a **camada Repository**: quando o sync via Supabase entrar, a
troca acontece num único arquivo (`data/index.ts`) e nenhuma tela muda.

## Decisões tomadas (com o dono)

| Tema | Decisão |
|---|---|
| Reestruturação | Projeto com build (Vite) |
| Escopo | Refatoração + as 2 features, uma entrega |
| Offline | Bom-ter, não obrigatório |
| Dados do casal | Locais agora (IndexedDB); arquitetura pronta para sync depois |
| IDs dos registros | UUID em **campo paralelo `uid`** (o Dexie recusa trocar a chave primária — ver abaixo). PK do IndexedDB continua numérica e nunca aparece nas telas. |
| Fonte de EAN | Supabase primeiro, Open Food Facts de reserva (cascata) |
| Base Supabase | Compartilhada, leitura e escrita públicas pela **anon key** (sem OAuth) |
| Foto do produto | Baixar da Open Food Facts, redimensionar ~200px, embutir como data URI. **Nunca** enviada ao Supabase (contribuição é só texto). |
| Modo Compra ao finalizar | Itens comprados ficam na lista com status "Comprado" (não somem) |
| 2ª compra na mesma lista | Mostra só os pendentes |
| Repositório | Um repo só (`uni9aluno/mercado`): fonte Vite na raiz, Actions publica |
| UI | Aproveitar para melhorar, dentro do estilo atual. Nenhuma mudança de UI altera o modelo de dados nem esconde função existente. |

## Duas surpresas que mudaram o plano

1. **O Dexie não deixa trocar a chave primária.** O plano previa migrar
   `++id` numérico → UUID in-place. O Dexie 4.4.5 recusa explicitamente
   (`UpgradeError: "Not yet support for changing primary key"`). Solução
   aprovada: UUID vira **campo paralelo `uid`**, indexado a partir da v5. As
   ligações entre tabelas passam a usar `uid`; a camada Repository devolve `uid`
   como `id` e o número interno nunca chega às telas. Migração segura (só
   adiciona índice), zero perda de dados.

2. **O `npm install` travava no proxy corporativo** (`SELF_SIGNED_CERT_IN_CHAIN`).
   O Node não enxerga o keystore do Windows onde mora a CA da rede. Resolvido
   apontando `NODE_EXTRA_CA_CERTS` para um bundle exportado do keystore
   (`app/.corp-ca.pem`, fora do git). O CI do GitHub roda fora do proxy e não
   precisa disso.

## Plano de execução (fases; cada uma termina verde e commitada)

- **Fase 0 — Andaime.** Scaffold Vite, Actions, ícones, provar o pipeline. ✅
- **Fase 1 — Núcleo de dados.** Schema v1-5, migração `uid`, seed, Repository. ✅
- **Fase 2 — Domínio.** Motor de preços, previsão, comparador (bug `limite90`
  corrigido), backup, barcode, `registrarCompra`. ✅
- **Fase 3 — UI base + hooks.** ~15 componentes `ui/`, hooks, roteador. ✅
- **Fase 4 — Telas portadas 1:1** (+ melhorias de UI acordadas). ✅ As 8 telas,
  portadas por agentes em paralelo (escopo isolado por diretório).
- **Fase 5 — Features novas.** ✅ Modo Compra (`features/buy-mode/`) e o leitor de
  código de barras (`features/barcode/`) + integração do catálogo EAN online.
- **Fase 6 — Paridade, migração real, publicação.** ✅ Checklist tela a tela,
  migração num perfil de navegador com dados v4 reais e publicação na mesma URL.

## Onde estamos

**Fases 0-6 completas. A reescrita está publicada em `main`.**

- Migração real v4→v5 validada na mesma origem, preservando dados e relações.
- Busca global restaurada (`Ctrl+K`/`Cmd+K`, desktop e mobile).
- Compatibilidade para instalações antigas garantida por
  `public/MercadoDoCasal.html`, que redireciona para a raiz nova.
- Pipeline GitHub Pages verde e URL pública verificada. Relatório completo em
  [`docs/FASE6.md`](docs/FASE6.md).

- 133 testes Vitest verdes, 15 arquivos (migração v4→v5, seed + corrida do
  StrictMode, motor de preços, previsão, comparador, backup, barcode,
  `registrarCompra`, cálculos puros de Dashboard/Calendário/cesta/Lista,
  `buyMode.calc`, `eanCatalog`).
- `tsc`, `eslint` e `vite build` (com PWA; Quagga2 vira chunk sob demanda de
  ~156 KB) limpos.
- As 8 telas + as 2 features novas rodam no navegador, console limpo.
  Verificado end-to-end:
  - **Modo Compra:** lista com mercado + pendentes → "Iniciar compra" → preview
    (totais certos) → ativo → marcar itens (cards atualizam) → lápis edita
    qtd/preço → "Finalizar compra" → compra gravada (preço editado persiste),
    shoppingItems viram "Comprado" (não somem), `shoppingSession` limpa.
  - **Leitor de EAN:** "Código" na Lista → digitar EAN inexistente → "produto
    não cadastrado" → "Vincular a produto existente" grava o `barcode`; com o
    catálogo online ligado, "Buscar dados online" consulta Supabase→OFF, baixa a
    foto (data URI), abre o `ProductForm` pré-preenchido; ao salvar,
    `contributeEan` faz POST só-texto ao Supabase. `BarcodeScanner` abre o portal
    de câmera em Produtos/ProductForm (cai no aviso de permissão quando a câmera
    não é liberada).

**Fase 4/5 — dívida quitada:**
- Os `icons.tsx` locais das features foram consolidados em `ui/icons.tsx`
  (`alert`, `share`, `pin`, `funnel`, `chevron` + `flag`/`save` novos).
- O shell (`App.tsx`/`routes.tsx`) agora passa `onNavigate` a toda tela — o
  botão "Ver histórico" de Registrar e do Modo Compra funciona.

**Dívida pequena restante (não bloqueante):**
- `PurchaseForm` edita a compra por "delete + recreate", o que troca o uid da
  compra. Funciona, mas seria mais limpo com `update`.

**Pendente de você (opcional):**
- **Quando quiser ativar o catálogo de EAN:** criar a tabela `ean_catalog` no seu
  Supabase (um bloco SQL para colar — cria a tabela e as policies de RLS) e colar
  Project URL + anon key na seção "Catálogo de códigos de barras (EAN)" da tela
  Config. Passo a passo completo, incluindo os três interruptores (busca online,
  Open Food Facts como reserva, contribuir com os cadastros) e o diagnóstico do
  "Testar conexão", em **[`docs/SUPABASE.md`](docs/SUPABASE.md)**. Sem isso o app
  funciona 100%, só o "Buscar dados online" fica inativo.

## O que NÃO precisa de você

- Nenhum login/OAuth. O catálogo EAN usa REST puro do PostgREST com a anon key
  (chave *pública*, feita para ficar em código de cliente). A base é
  compartilhada e aberta de propósito; o risco assumido — alguém inserir lixo —
  fica contido por não haver policy de `DELETE` (ninguém apaga dados dos outros)
  e pelo campo `source`, que marca a origem de cada linha. Detalhes e mitigação
  em `docs/SUPABASE.md`.
- Nenhuma foto sai do aparelho. A contribuição para o catálogo é só texto (nome,
  marca, peso); as fotos vêm da Open Food Facts e ficam apenas no IndexedDB.
- Nenhum export/import manual de dados na migração — ela roda sozinha na
  primeira vez que o app novo abrir, no mesmo endereço.
