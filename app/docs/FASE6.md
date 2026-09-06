# Fase 6 — paridade, migração e publicação

Validação executada em 06/09/2026 sobre a branch `vite-rewrite`.

## Qualidade automatizada

- `npm run lint`: verde, zero warnings.
- `npm test`: 133 testes verdes em 15 arquivos.
- `npm run build`: TypeScript e build Vite/PWA verdes.
- Build inclui manifesto, ícones, service worker Workbox e o chunk Quagga sob demanda.

## Migração real v4 → v5

Procedimento usado:

1. Servir `MercadoDoCasal.html` em `http://localhost:8123`.
2. Abrir a versão legada e criar pela própria interface um mercado, uma lista e dois
   itens com quantidades/prioridades diferentes, sobre o seed e histórico v4.
3. Trocar o conteúdo servido pelo build novo, mantendo protocolo, host e porta.
4. Abrir `/mercado/`, o que executa a migração Dexie sobre o mesmo `MercadoDB`.

Resultado: preservados orçamento/regras, categorias, mercados (incluindo o criado no
teste), produtos, histórico, backups automáticos, lista ativa, vínculo com mercado,
itens, quantidades e prioridades. A UI passou a operar com os UUIDs paralelos da v5
sem expor as chaves numéricas antigas. Console sem erros ou warnings.

## Paridade e navegação

- As oito telas abriram com os dados migrados: Início, Lista, Registrar, Produtos,
  Comparar, Histórico, Calendário e Config.
- Lista ativa e relações produto/lista/mercado foram conferidas visualmente.
- Busca global portada na Fase 6: botão desktop, entrada no menu móvel, atalho
  `Ctrl+K`/`Cmd+K`, busca sem acento em produtos, itens, compras, listas e mercados,
  e navegação a partir do resultado.
- Modo Compra e fluxo EAN haviam sido validados end-to-end na Fase 5.
- Layout conferido em desktop e em viewport móvel 390 × 844; o menu “Mais” dá acesso
  a Buscar, Comparar, Calendário e Config.

## Compatibilidade de atualização

O build mantém `MercadoDoCasal.html` como redirecionamento para `./`. Isso evita 404
em PWAs antigos cujo `start_url` ainda aponta para o nome legado e permite que eles
carreguem o novo `index.html`/service worker. O redirecionamento foi testado na mesma
origem usada na migração.

## Publicação

O workflow `.github/workflows/deploy.yml` valida e publica `app/dist` quando `main`
recebe push. Após a execução remota, conferir:

- URL raiz responde com o app novo.
- `/mercado/MercadoDoCasal.html` redireciona para `/mercado/`.
- `manifest.webmanifest` e `sw.js` respondem 200.
- O workflow GitHub Pages terminou verde.
