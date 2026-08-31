```markdown
# Plano de Evolução — Mercado do Casal

**Base (quando o plano foi escrito):** `MercadoDoCasal-corrigido.html`, schema v2, CSS na linha 11, app na linha 360. **Hoje:** o arquivo é `MercadoDoCasal.html`, schema v4, app na linha **361** (a 360 é o `<script>` do Quagga2). Ondas 1–3 concluídas — ver `HANDOFF.md`.
**Princípios:** Arquivo único, zero backend, offline absoluto, privacidade total, APIs nativas do navegador.
**Regras invioláveis:** Ver `CLAUDE.md` — âncoras de string, patches de trás para frente, Tailwind pré-compilado auditado na linha 11, `db.version(1)` e `db.version(2)` nunca removidos, `active` como `0`/`1` nunca booleano.

---

## Ondas de Implementação

### Onda 1 — Impacto Imediato

> Maior ganho de experiência com menor risco de quebrar o que existe.

---

#### 1.1. Ações de Deslizar (Swipe Actions) na Lista

**Problema:** Marcar como comprado ou excluir exige toque preciso em botões pequenos.

**Solução:**
- Deslizar para a direita → botão verde "Comprado" revelado.
- Deslizar para a esquerda → botão vermelho "Excluir" revelado.
- Implementação com `touchstart`, `touchmove`, `touchend` + `mousedown`/`mousemove`/`mouseup` para desktop.
- Threshold de ângulo: se o deslize for > 30° da horizontal, é scroll vertical (ignorar swipe). Se ≤ 30° e > 40px de distância horizontal, é swipe.
- Threshold mínimo de 40px para revelar; abaixo disso, animação de recoil com `transform: translateX(0)` e `transition: transform 200ms ease-out`.
- Ao revelar, os botões ficam visíveis com `position: absolute` e `transform: translateX(...)` no item. Toque no botão executa a ação; toque fora recolhe.
- Animação de recoil se o usuário não deslizar o suficiente.

**Classes Tailwind necessárias (adicionar na linha 11):**
- `touch-none`, `select-none`, `transform`, `transition-transform`, `duration-200`, `ease-out`, `absolute`, `right-0`, `top-0`, `bottom-0`, `min-h-[48px]`, `-translate-x-full`, `translate-x-full`, `bg-green-600`, `bg-red-600`, `text-white`, `rounded-r-lg`, `rounded-l-lg`, `flex`, `items-center`, `px-4`, `font-medium`

**Schema:** Nenhuma mudança.

**Testes:**
- Swipe direito marca como comprado, swipe esquerdo exclui com confirmação.
- Scroll vertical não dispara swipe.
- Desktop: drag com mouse funciona igual.
- Recoil em deslize curto (< 40px).
- Item recolhe ao tocar fora dos botões.
- `document.scrollWidth === clientWidth` em 375px (sem estouro horizontal).

---

#### 1.2. Clonagem Inteligente de Lista (Smart Clone)

**Problema:** Refazer a lista mensal do Atacarejo do zero toda vez é retrabalho.

**Solução:**
- Na tela Lista, no menu `⋯` de uma lista, adicionar opção "Clonar última compra".
- Busca o último `purchase` com `storeId` igual ao da lista atual.
- Cria uma nova `shoppingList` (nome: "Lista – {nome do mercado} (clonada DD/MM)") com os `purchaseItems` convertidos em `shoppingItems` com `status: "pending"`.
- Segunda variante: no menu de uma lista **desativada**, opção "Clonar e reativar" — clona os itens para uma lista nova ativa.
- Itens que o app prevê que ainda tem em casa (baseado na frequência vs. dias desde última compra) são marcados com um indicador visual "talvez não precise" (ex.: ícone de interrogação ou opacidade reduzida), mas permanecem na lista — o usuário decide.

**Schema:** Nenhuma mudança.

**Testes:**
- Clone de lista com 5 itens cria nova lista com 5 itens pendentes.
- Clone de lista desativada cria lista ativa separada; a desativada permanece desativada.
- Lista sem compras anteriores mostra toast "Nenhuma compra registrada nesse mercado".
- Itens com previsão de "ainda tem" aparecem com indicador visual mas estão na lista.

---

#### 1.3. Busca Global

**Problema:** Encontrar um produto, compra ou lista específica exige navegar por várias telas.

**Solução:**
- Ícone de lupa na barra superior (ou no menu lateral) que abre um campo de busca full-screen ou overlay.
- Ao digitar (debounce de 300ms), busca simultaneamente em:
  - `products` (nome, marca),
  - `shoppingLists` (nome),
  - `shoppingItems` (via join com `products`),
  - `purchases` (via join com `purchaseItems` → `products`),
  - `stores` (nome).
- Resultados agrupados por tipo: "Produtos (3)", "Listas (1)", "Compras (2)", "Mercados (1)".
- Cada resultado é tocável e navega para a tela/tela+filtro correspondente.
- Limpar o campo volta ao estado anterior.
- Atalho de teclado no desktop: `Ctrl+K` abre a busca (padrão universal).

**Classes Tailwind necessárias (linha 11):**
- `fixed`, `inset-0`, `z-50`, `bg-black/50`, `flex`, `items-start`, `justify-center`, `pt-16`, `px-4`, `bg-white`, `rounded-xl`, `shadow-xl`, `max-w-lg`, `w-full`, `mx-auto`, `overflow-hidden`, `divide-y`, `divide-gray-100`, `text-sm`, `text-gray-500`, `font-semibold`, `px-4`, `py-2`, `py-3`, `cursor-pointer`, `hover:bg-gray-50`, `active:bg-gray-100`

**Schema:** Nenhuma mudança.

**Testes:**
- Digitar "arroz" encontra o produto, listas que contêm arroz, e compras com arroz.
- Resultados corretamente agrupados.
- Tocar em um resultado navega para a tela correta.
- `Ctrl+K` abre no desktop.
- Busca vazia não mostra resultados; campo limpo esconde resultados.
- Performance: 100 produtos + 50 compras, busca instantânea (nenhum lag visível).

---

#### 1.4. Undo em Ações Destrutivas

**Problema:** Excluir item ou lista sem querer causa desespero.

**Solução:**
- Ao excluir um `shoppingItem`, `shoppingList` ou `purchase` (quando implementado), mostrar snackbar na base da tela: "Item excluído. [Desfazer]".
- O item é movido para uma variável em memória (não deletado do banco ainda).
- Timer de 5 segundos. Se o usuário tocar "Desfazer", restaura. Se o timer expira, executa a deleção real no IndexedDB.
- Snackbar posicionado acima da barra inferior no mobile, na base da tela no desktop.
- Apenas um undo ativo por vez (novo undo substitui o anterior e executa o anterior imediatamente).

**Classes Tailwind necessárias (linha 11):**
- `fixed`, `bottom-16`, `left-4`, `right-4`, `sm:bottom-4`, `bg-gray-800`, `text-white`, `rounded-lg`, `px-4`, `py-3`, `flex`, `items-center`, `justify-between`, `shadow-lg`, `text-sm`, `font-medium`, `underline`, `cursor-pointer`

**Schema:** Nenhuma mudança.

**Testes:**
- Excluir item → snackbar aparece → tocar "Desfazer" → item volta.
- Excluir item → snackbar aparece → esperar 5s → item desaparece definitivamente.
- Dois excludes rápidos → o primeiro é executado, o segundo fica com undo ativo.
- Snackbar não cobre a barra inferior no mobile (375px).

---

#### 1.5. Lembrete Periódico de Backup

**Problema:** O usuário esquece de fazer backup e perde tudo se o aparelho quebrar.

**Solução:**
- Na tabela `settings`, nova chave `lastBackup` com timestamp (`Date.now()`).
- Atualizar essa chave toda vez que um backup é gerado com sucesso.
- Na tela Início, se `lastBackup` é nulo ou tem mais de 7 dias, mostrar card amarelo persistente: "Último backup há X dias. [Fazer backup agora]". O botão navega para Config → Backup.
- Se < 7 dias, não mostrar nada (sem ruído).
- Na tela Config, ao lado de "Backup e restauração", mostrar texto cinza: "Último: DD/MM/AAAA HH:MM" (ou "Nunca" se `lastBackup` for nulo).

**Schema:**
- `settings`: nova chave `lastBackup` (número, timestamp). Sem migration — `settings.get()` retorna `undefined` para chaves inexistentes, que é tratado como "nunca".

**Classes Tailwind necessárias (linha 11):**
- `bg-amber-50`, `border`, `border-amber-200`, `rounded-lg`, `p-3`, `text-amber-800`, `text-sm`, `font-medium`, `underline`, `cursor-pointer`, `text-gray-400`, `text-xs`

**Testes:**
- Primeiro uso (sem `lastBackup`): card aparece "Nunca feito backup".
- Backup feito: card desaparece do Início; Config mostra data/hora.
- Após 7 dias sem backup: card reaparece no Início.
- Fazer backup pelo card navega para Config com foco na seção de backup.

---

#### 1.6. Checksum SHA-256 no Backup JSON

**Problema:** Backup corrompido (ex.: transferência truncada via WhatsApp) causa restore silencioso com dados quebrados.

**Solução:**
- Ao gerar o backup JSON, calcular `crypto.subtle.digest('SHA-256', encodedData)` e incluir o hash hex como campo `_checksum` no objeto antes de serializar.
- Ao restaurar, ler `_checksum`, recalcular o hash do restante do JSON (sem o campo `_checksum`), comparar. Se divergir, mostrar erro: "Arquivo de backup corrompido. Tente transferir novamente." e abortar o restore.
- `crypto.subtle` é nativo em todos os browsers modernos. Retorna Promise — async/await no fluxo de restore.
- Backups antigos (sem `_checksum`) são aceitos sem verificação — apenas log no console: "Backup sem checksum, pulando verificação".

**Schema:** Nenhum (muda só o formato do JSON de backup, não o banco).

**Testes:**
- Gerar backup → arquivo contém `_checksum`.
- Restaurar backup intacto → sucesso.
- Alterar 1 byte do backup manualmente → restore mostra erro de corrupção.
- Restaurar backup v1 (sem `_checksum`) → sucesso com aviso no console.

---

#### 1.7. Compartilhar Lista via String Comprimida e QR Code

**Problema:** Enviar a lista do dia para o parceiro exige exportar o banco inteiro.

**Solução:**
- Na tela Lista, no menu `⋯`, opção "Compartilhar lista".
- Extrai apenas a lista ativa (nome, mercado, itens com nome/produto/quantidade) em um JSON mínimo.
- Comprime com `CompressionStream('gzip')` → `ArrayBuffer` → base64.
- Se o resultado tem ≤ 2000 caracteres: oferece dois botões: "Copiar texto" (copia a string para clipboard via `navigator.clipboard.writeText()`) e "QR Code".
- Se > 2000 caracteres: oferece apenas "QR Code" (texto longo demais para WhatsApp).
- QR Code desenhado em SVG puro (sem biblioteca): calcular a matriz QR com implementação leve (~200 linhas de JS, algoritmo de Reed-Solomon + mask pattern), renderizar como `<svg>` com `<rect>` para cada módulo escuro. Fundo transparente, módulos em preto, tamanho adaptativo ao container.
- Na tela de importação (Config → "Importar lista via código"): campo de texto para colar a string, ou botão "Escanear QR" que abre a câmera, lê o QR e preenche o campo.
- Ao importar: descomprime, parseia o JSON, cria nova `shoppingList` com os itens (produtos existentes são vinculados por nome; novos produtos são criados no catálogo com dados mínimos).

**Classes Tailwind necessárias (linha 11):**
- `max-w-xs`, `mx-auto`, `bg-white`, `p-4`, `rounded-lg`, `border`, `aspect-square`, `gap-2`, `text-center`, `text-xs`, `text-gray-500`, `break-all`, `font-mono`

**Schema:**
- Nenhuma mudança no banco. Produtos novos são criados em `products` com campos mínimos (`name`, `category: null`, `frequency: null`, etc.).

**Testes:**
- Lista com 5 itens → string < 2000 chars → botões "Copiar" e "QR" aparecem.
- Lista com 50 itens → string > 2000 chars → só "QR" aparece.
- Colar string no campo de importação → lista criada com itens corretos.
- Escanear QR → mesmo resultado.
- Produtos inexistentes no catálogo são criados.
- Produtos existentes são vinculados (não duplicados).
- String corrompida → erro "Código inválido".

---

### Onda 2 — Curto Prazo

> Mais inteligência no app. Ainda sem mudar schema (exceto `paymentMethod` e `buyer`).

---

#### 2.2. Previsão de Reposição (Frequência Real)

**Problema:** O usuário não lembra o que está acabando até faltar.

**Solução:**
- Na tela Início, seção "Pode precisar repostar" com cards de produtos.
- Lógica (em `useMemo`):
  1. Para cada produto com `frequency > 0` e pelo menos 2 compras registradas:
     - Buscar todas as compras desse produto, ordenar por data desc.
     - Calcular intervalo médio real entre compras (não usar `frequency` cadastrado como verdade absoluta).
     - Se o intervalo médio real tem pelo menos 2 amostras, usar ele. Senão, usar `frequency` cadastrado.
  2. Calcular "dias até acabar" = intervalo médio - dias desde última compra.
  3. Se "dias até acabar" ≤ 7, incluir no card.
- Cada card mostra: emoji ou ícone da categoria, nome do produto, "Pode acabar em X dias", botão "Adicionar à lista" (abre picker de qual lista).
- Badge de confiança: se baseado em ≥ 4 compras, sem badge. Se 2-3 compras, badge pequeno "pouco histórico". Se 1 compra, não sugerir.
- Não sugerir se o produto já está em alguma lista ativa como pendente.
- Limitar a 8 cards máximo para não poluir o Início.

**Schema:** Nenhuma mudança (usa dados existentes).

**Classes Tailwind necessárias (linha 11):**
- `grid`, `grid-cols-1`, `sm:grid-cols-2`, `gap-2`, `bg-orange-50`, `border`, `border-orange-200`, `rounded-lg`, `p-3`, `text-orange-900`, `text-sm`, `text-xs`, `text-gray-500`

**Testes:**
- Produto comprado há 25 dias com frequência 30 → card aparece "5 dias".
- Produto comprado ontem com frequência 30 → não aparece.
- Produto já na lista como pendente → não aparece.
- Produto com 1 compra → não aparece.
- Máximo de 8 cards.
- Botão "Adicionar à lista" abre picker e adiciona.

---

#### 2.3. Gráficos SVG de Evolução de Preço

**Problema:** Não saber se o preço de um produto está subindo ao longo do tempo.

**Solução:**
- Na tela do produto (ao tocar num produto no Comparar ou em Produtos), se houver ≥ 2 compras com preço, mostrar mini-gráfico SVG.
- `useMemo` calcula os pontos: `{x: índice, y: preço}`.
- Eixo Y inteligente: `minY = Math.min(...preços) * 0.95`, `maxY = Math.max(...preços) * 1.05`. Nunca cortar perto de zero se os preços são parecidos.
- SVG com `viewBox` calculado, `<polyline>` para a linha, `<circle>` em cada ponto.
- Tooltip ao tocar/clique: `<circle>` invisível maior (r=15) em cada ponto com `onTouchStart`/`onClick` que posiciona um `<div>` absoluto com data e valor formatados.
- Se o produto foi comprado em ≥ 2 mercados, sobrepor linhas com cores diferentes e traçados diferentes (sólido vs. pontilhado `stroke-dasharray`). Legenda abaixo do gráfico.
- Paleta acessível: não depender só de cor. Usar `stroke-dasharray` + formato do marcador (círculo vs. quadrado).
- Tamanho: 100% da largura do container, altura fixa de 160px.

**Classes Tailwind necessárias (linha 11):**
- `w-full`, `h-40`, `mt-2`, `relative`, `absolute`, `bg-gray-800`, `text-white`, `text-xs`, `rounded`, `px-2`, `py-1`, `pointer-events-none`, `flex`, `gap-4`, `justify-center`, `text-sm`, `mt-1`

**Schema:** Nenhuma mudança.

**Testes:**
- Produto com 5 compras → gráfico com 5 pontos e linha conectando.
- Tooltip mostra data e preço corretos ao tocar.
- Eixo Y não corta variação pequena (preços entre 5,00 e 5,20 → eixo de 4,80 a 5,20).
- Dois mercados → duas linhas sobrepostas com legenda.
- Produto com 1 compra → sem gráfico, sem espaço vazio.
- Responsivo: largura se adapta ao container.

---

#### 2.4. Queima de Orçamento por Método de Pagamento

**Problema:** O casal não sabe se está usando bem o VR/VA ou gastando dinheiro extra desnecessariamente.

**Solução:**
- Schema v3: adicionar campo `paymentMethod` em `purchases` (string: `"vr"`, `"va"`, `"dinheiro"`, `"cartao_credito"`, `"cartao_debito"`, `"pix"`, `"outro"`).
- Na tela Início, abaixo do orçamento geral, duas barras de progresso:
  - "VR/VA": teto é `budget.vrva`, gasto é soma de purchases do mês com `paymentMethod` em `["vr", "va"]`.
  - "Dinheiro/Outros": teto é `budget.extra`, gasto é soma do resto.
- Cores: verde enquanto < 70%, amarelo 70-90%, vermelho > 90%.
- Recomendação ativa abaixo das barras: se VR/VA < 70% usado e faltam < 5 dias para o vencimento (configurável), mostrar: "Você ainda tem R$ X de VR/VA. Considere usar antes do vencimento."

**Schema (v3):**
```
purchases ++id,date,storeId,paymentMethod
```
- Migration `db.version(3).stores(...)` com `.upgrade()` que seta `paymentMethod: "dinheiro"` em todos os registros existentes.
- `db.version(1)` e `db.version(2)` mantidos intactos.

**Classes Tailwind necessárias (linha 11):**
- `h-3`, `bg-green-500`, `bg-yellow-500`, `bg-red-500`, `bg-gray-200`, `rounded-full`, `overflow-hidden`, `text-xs`, `text-gray-600`, `mt-1`

**Testes:**
- Migração v2 → v3: compras existentes ganham `paymentMethod: "dinheiro"`.
- Registrar compra com VR → barra VR aumenta.
- Barras com cores corretas por percentual.
- Recomendação aparece quando VR subutilizado perto do vencimento.
- Recomendação não aparece se VR bem utilizado ou longe do vencimento.

---

#### 2.5. Campo "Quem Comprou" (Buyer)

**Problema:** O casal quer saber quem foi ao mercado e equilibrar a divisão de tarefas.

**Solução:**
- Schema v3 (mesma migration da 2.4): adicionar campo `buyer` em `purchases` (string: `"ele"`, `"ela"`, `"juntos"`, `null`).
- No Registrar Compra, campo opcional "Quem comprou" com 4 opções (null = não informado).
- Na tela Início, mini-resumo: "Ele: R$ X | Ela: R$ Y | Juntos: R$ Z" (apenas para o mês atual).
- No Histórico, ícone pequeno ao lado de cada compra indicando quem comprou.

**Schema (v3):**
```
purchases ++id,date,storeId,paymentMethod,buyer
```
- Migration: `buyer: null` em registros existentes.

**Classes Tailwind necessárias (linha 11):**
- `text-xs`, `text-gray-400`, `gap-3`, `inline-flex`, `items-center`, `gap-1`

**Testes:**
- Migração: compras antigas com `buyer: null`.
- Registrar com "Ele" → aparece no resumo do Início.
- Resumo soma corretamente por buyer.
- Histórico mostra ícone corretamente.
- `null` não aparece no resumo (soma dos informados).

---

### Onda 3 — Médio Prazo

> Funcionalidades mais complexas, algumas exigem schema v3+.

---

#### 3.1. Leitor de Código de Barras (Barcode Scanner)

**Problema:** Localizar produtos na prateleira ou registrar compra apontando a câmera.

**Solução:**
- Feature detection: se `BarcodeDetector` existe no `window`, mostrar opções. Se não, omitir.
- Schema v3: adicionar campo `barcode` em `products` (string, EAN-13, pode ser `null`). **Não único** — mesmos EAN podem ter variantes.
- Dois pontos de entrada:
  1. **Na Lista:** botão "Escanear" que abre câmera. Ao detectar EAN, busca na tabela `products` por `barcode`. Se um único resultado, marca como comprado com vibração. Se múltiplos, mostra picker. Se nenhum, toast "Produto não cadastrado com esse código".
  2. **No Registrar:** botão "Escanear produto" ao adicionar item. Detecta EAN, preenche o campo de produto automaticamente. Usuário confirma e informa preço/quantidade.
- Câmera via `getUserMedia({video: {facingMode: "environment"}})`. Vídeo em `<video>` full-screen overlay.
- `BarcodeDetector.detect(video)` em loop via `requestAnimationFrame`.
- Ao detectar: vibração (`navigator.vibrate(100)`), destaque visual (flash verde no overlay), fecha câmera após 1s.
- Timeout de 30s sem detecção → fecha com toast "Nenhum código detectado".

**Schema (v3):**
```
products ++id,name,category,frequency,barcode
```
- Migration: `barcode: null` em registros existentes.

**Classes Tailwind necessárias (linha 11):**
- `fixed`, `inset-0`, `z-50`, `bg-black`, `object-cover`, `w-full`, `h-full`

**Testes:**
- Botão não aparece em browsers sem `BarcodeDetector`.
- Escanear EAN de produto cadastrado → encontra e age conforme contexto.
- Múltiplos produtos com mesmo EAN → picker.
- EAN não cadastrado → toast informativo.
- Timeout de 30s funciona.
- Vibração e feedback visual presentes.
- Câmera fecha corretamente após detecção ou timeout.

---

#### 3.3. Calendário de Compras

**Problema:** Não ter visão temporal de quando as compras aconteceram ou vão acontecer.

**Solução:**
- Nova tela "Calendário" no menu (ou acessível pelo Início).
- Grid SVG/HTML de 7 colunas (Dom-Sáb), 4-6 linhas, renderizado com `useMemo`.
- Dias do mês atual com bolinha colorida se há compra registrada (cor por mercado, legenda abaixo).
- Toque num dia com compra → abre os detalhes da compra (mesmo comportamento do Histórico).
- Dias projetados para reposição: bolinha tracejada laranja nos dias onde produtos frequentes devem acabar (baseado na previsão da onda 2.2).
- Navegação mês anterior/próximo.
- Implementação com HTML/CSS grid (não precisa de SVG — é mais simples com Tailwind).

**Classes Tailwind necessárias (linha 11):**
- `grid`, `grid-cols-7`, `gap-px`, `bg-gray-200`, `text-center`, `text-xs`, `py-2`, `text-gray-400`, `text-gray-900`, `font-bold`, `relative`, `w-2`, `h-2`, `rounded-full`, `mx-auto`, `mt-0.5`, `border`, `border-orange-300`, `border-dashed`

**Schema:** Nenhuma mudança (usa `purchases` existente).

**Testes:**
- Grid mostra dias corretos do mês.
- Dias com compra têm bolinha com cor do mercado.
- Toque no dia abre detalhes da compra.
- Navegação mês anterior/próximo funciona.
- Dias projetados mostram bolinha tracejada.
- Responsivo em 375px.

---

#### 3.4. Auto-Backup Silencioso

**Problema:** Se o usuário esquecer o backup manual e o aparelho quebrar, perde tudo.

**Solução:**
- Nova tabela `autoBackups`: `{id: auto, date, data}` onde `data` é o JSON stringificado do backup completo.
- A cada vez que o app abre, verificar:
  1. `navigator.storage.estimate()` → se espaço disponível < 10 MB, não fazer nada.
  2. Último auto-backup: buscar o mais recente em `autoBackups`. Se tem menos de 24h, não fazer.
  3. Senão, gerar backup JSON, salvar em `autoBackups`.
- Manter no máximo 3 auto-backups (ao criar o 4º, excluir o mais antigo).
- Na Config, seção "Backups automáticos": mostrar "3 backups automáticos armazenados. Último: DD/MM HH:MM". Botão "Restaurar último auto-backup" (com confirmação).
- Não substitui o backup manual — é rede de segurança invisível.

**Schema (v3):**
```
autoBackups ++id,date
```
- `data` não indexado (pode ser grande). Lido por chave primária.

**Classes Tailwind necessárias (linha 11):**
- `text-xs`, `text-gray-400`, `text-green-600`

**Testes:**
- Primeiro acesso: cria auto-backup.
- Segundo acesso em < 24h: não cria novo.
- Após 24h: cria novo, mantém máximo de 3.
- Espaço < 10 MB: não cria.
- Restaurar auto-backup funciona igual restore manual.
- Config mostra data e quantidade corretas.

---

#### 3.5. Editar/Excluir Compra

**Problema:** Erro ao registrar compra não pode ser corrigido.

**Solução:**
- No Histórico, ao expandir uma compra, botão "Editar" e "Excluir".
- **Editar:** abre modal pré-preenchido com os dados da compra (data, mercado, forma de pagamento, buyer, itens com quantidade e preço). Ao salvar, atualiza `purchase` e `purchaseItems` (deletar todos os antigos e recriar — mais simples que diff). Recalcular preço total. Mostrar toast "Compra atualizada".
- **Excluir:** confirmação com nome do mercado, data e total. Ao confirmar: deletar `purchaseItems` em cascata, depois `purchase`. **Não** devolver itens à lista (comportamento diferente de undo — aqui é exclusão consciente). Toast com undo (ideia 1.4) por 5 segundos: se desfazer, recria a compra e os itens.

**Schema:** Nenhuma mudança.

**Classes Tailwind necessárias (linha 11):**
- `fixed`, `inset-0`, `z-50`, `bg-black/50`, `flex`, `items-center`, `justify-center`, `bg-white`, `rounded-xl`, `max-w-lg`, `w-full`, `mx-auto`, `p-4`, `max-h-[80vh]`, `overflow-y-auto`

**Testes:**
- Editar compra: dados pré-preenchidos corretamente. Salvar atualiza no banco e no Histórico.
- Excluir compra: confirmação mostra dados corretos. Confirma → desaparece. Undo dentro de 5s restaura.
- Excluir não devolve itens à lista.
- Histórico recalcula totais após edição/exclusão.

---

#### 3.6. Navegação por Teclado (Desktop)

**Problema:** No desktop, o app só funciona com mouse.

**Solução:**
- `Tab` navega entre itens interativos (focus visible com `ring-2 ring-blue-500`).
- `Enter` ou `Space` em item da lista → marca como comprado.
- `Delete` ou `Backspace` em item focado → exclui (com undo).
- `Ctrl+K` → abre busca global (ideia 1.3).
- `Escape` → fecha modal/overlay/busca.
- `Setas` ↑↓ na lista → move foco entre itens.
- Aplicar `tabIndex={0}` e `onKeyDown` nos itens da lista e botões principais.
- CSS: `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none` adicionado à linha 11.

**Classes Tailwind necessárias (linha 11):**
- `focus-visible:ring-2`, `focus-visible:ring-blue-500`, `focus-visible:outline-none`, `focus-visible:ring-offset-2`

**Schema:** Nenhuma mudança.

**Testes:**
- Tab navega entre itens da lista.
- Enter marca como comprado.
- Delete exclui com undo.
- Ctrl+K abre busca.
- Escape fecha overlays.
- Setas movem foco.
- Anel de foco visível em todos os elementos interativos.

---

#### 3.7. Avaliação Pós-Compra e "Não Encontrei"

**Problema:** Sem feedback qualitativo sobre a experiência no mercado.

**Solução:**
- Schema v3: campo `rating` em `purchases` (string: `"ok"`, `"lotado"`, `"faltou"`, `"preco_ruim"`, `null`) e campo `missingItems` (array de strings, nomes de produtos não encontrados).
- Na tela de sucesso pós-compra, seção opcional "Como foi?" com 4 chips: "Tranquilo ✓", "Lotação", "Faltou produto", "Preço ruim". Opcional — pode ignorar.
- Se "Faltou produto": mostrar lista dos itens da compra com checkboxes "Não encontrei". Os marcados vão para `missingItems`.
- Na tela Comparar, ao lado de cada mercado, se há ≥ 3 compras com `rating: "faltou"` nos últimos 90 dias, mostrar badge "Frequentemente falta item".
- Na Lista, ao deslizar (ideia 1.1) ou toque longo, opção "Não encontrado nesse mercado". Se o mesmo item é marcado "não encontrado" 2+ vezes no mesmo mercado, sugerir ao adicionar à lista: "Esse produto frequentemente não é encontrado no Mercado X. Adicionar mesmo assim?"

**Schema (v3):**
```
purchases ++id,date,storeId,paymentMethod,buyer,rating,missingItems
```
- Migration: `rating: null`, `missingItems: []`.

**Classes Tailwind necessárias (linha 11):**
- `flex-wrap`, `gap-2`, `px-3`, `py-1.5`, `rounded-full`, `text-xs`, `border`, `cursor-pointer`, `bg-green-100`, `text-green-700`, `border-green-200`, `bg-red-100`, `text-red-700`, `border-red-200`, `bg-yellow-100`, `text-yellow-700`, `border-yellow-200`, `bg-blue-100`, `text-blue-700`, `border-blue-200`

**Testes:**
- Avaliação opcional: ignorar não salva nada.
- Avaliar "Faltou" → checkboxes aparecem → marcar 2 itens → salvos em `missingItems`.
- Comparar mostra badge quando ≥ 3 "faltou" em 90 dias.
- "Não encontrado" na Lista: ao repetir 2x, sugere confirmação.
- Migração: compras antigas com `rating: null`, `missingItems: []`.

---

### Onda 4 — Longo Prazo

> Alta ambição, maior complexidade, alguns riscos de compatibilidade.

---

#### 4.1. Sincronização via File System Access API

**Problema:** Sync manual é chato; o casal quer que os dados estejam sincronizados.

**Solução:**
- Feature detection: `'showDirectoryPicker' in window`. Se não, não mostrar a opção.
- Em Config, seção "Sync por pasta (experimental)":
  - Botão "Selecionar pasta" → `window.showDirectoryPicker()` → armazena o `FileSystemDirectoryHandle` em variável de módulo (não persistente — precisa re-selecionar ao reabrir o app, mas o caminho pode ser lembrado via `localStorage` para re-solicitar permissão silenciosamente com `verifyPermission()`).
  - A cada mudança nos dados (debounce de 2s após última mutação), serializar backup JSON e gravar como `mercado-sync.json` na pasta selecionada.
  - Polling a cada 10s: ler `mercado-sync.json` da pasta. Se o `_checksum` for diferente do último salvo local, oferecer: "Dados atualizados encontrados na pasta. [Importar] [Ignorar]".
  - Merge por registro: para cada tabela, comparar por `id`. Se existe local e na pasta, manter o com `timestamp` maior (adicionar campo `_ts` em cada registro, atualizado a cada write). Se existe só em um lugar, criar no outro.
- **Limitações documentadas na UI:** "Funciona apenas no Chrome/Edge desktop. Não funciona no iOS. Requer que ambos os dispositivos acessem a mesma pasta (ex.: Google Drive desktop, pasta de rede)."

**Riscos e mitigações:**
- Permissão expira → `verifyPermission()` com `requestPermission()` silencioso. Se negado, mostrar aviso "Permissão expirada. Selecione a pasta novamente."
- Concorrência → timestamps + merge por registro. Documentar que edição simultânea no mesmo produto pode causar perda de um dos campos (merge granular por campo é complexo demais para single file).
- iOS/Safari → opção oculta, sem fallback.

**Schema (v4):**
- Todas as tabelas ganham campo `_ts` (número, `Date.now()`, atualizado a cada write).
- Migration v4: seta `_ts: Date.now()` em todos os registros existentes.
- `_ts` não precisa de índice.

**Classes Tailwind necessárias (linha 11):**
- `bg-blue-50`, `border-blue-200`, `text-blue-800`, `text-xs`, `animate-spin`

**Testes:**
- Chrome desktop: selecionar pasta → gravar arquivo → ler de volta → sync funciona.
- Permissão expirada → aviso correto.
- Merge: registro editado nos dois lados → prevalece o mais recente.
- Safari/iOS: opção não aparece.
- Polling de 10s não degrada performance.

---

#### 4.2. Log de Alterações (Audit Trail Leve)

**Problema:** Merge de sync precisa de contexto; usuário precisa saber o que mudou.

**Solução:**
- Nova tabela `changeLog`: `{++id, table, recordId, field, oldValue, newValue, timestamp}`.
- Logar apenas operações destrutivas: `delete` em `purchases`, `purchaseItems`, `shoppingItems`, `shoppingLists`, `products`.
- Não logar creates nem updates normais (para não inflar).
- Purge automático: ao abrir o app, deletar logs com `timestamp` > 90 dias.
- Na tela de restore/sync, se houver conflito, mostrar: "Produto X foi excluído em DD/MM às HH:MM no aparelho local. [Manter exclusão] [Restaurar do backup]".
- No restore manual: após importar, se o banco local tem registros que o backup não tem, verificar `changeLog` para cada ausência. Se há log de exclusão, manter a exclusão. Se não há log (registro simplesmente não existe no backup), perguntar.

**Schema (v4):**
```
changeLog ++id,table,recordId,field,oldValue,newValue,timestamp
```

**Testes:**
- Excluir compra → log criado com dados corretos.
- Criar produto → sem log.
- Purge remove logs > 90 dias.
- Restore com conflito mostra opções baseadas no log.

---


#### 4.5. Notificações do Sistema (PWA)

**Problema:** O usuário só lembra do app quando abre. Precisa de lembretes proativos.

**Solução:**
- Depende da PWA (ideia 3.2) estar instalada — sem SW, não funciona.
- Ao instalar, solicitar `Notification.requestPermission()`.
- Agendar notificações via `setTimeout` (não persiste entre sessions — precisa re-agendar ao abrir o app):
  - Se há itens na previsão de reposição (ideia 2.2), agendar notificação para o dia projetado de reposição: "🍚 Arroz pode acabar hoje. Adicionar à lista?".
  - Se orçamento > 80% usado e faltam > 3 dias no mês, notificar: "Orçamento do mês está em X%. Restam R$ Y."
  - Se VR/VA subutilizado e faltam ≤ 3 dias para vencimento (precisa de campo `vrvaExpiry` em `settings`), notificar: "Você tem R$ X de VR/VA não usado. Vence em Y dias."
- Ao abrir o app, recalcular e re-agendar todas as notificações.
- Limitar a 3 notificações por dia para não ser spam.

**Schema (v4):**
- `settings`: nova chave `vrvaExpiry` (número, dia do mês de vencimento, ou `null`).
- `settings`: nova chave `notificationsEnabled` (`0` ou `1`).

**Classes Tailwind necessárias (linha 11):**
- `toggle` customizado (CSS puro, sem biblioteca): `relative`, `w-11`, `h-6`, `bg-gray-300`, `rounded-full`, `after:content-['']`, `after:absolute`, `after:top-0.5`, `after:left-0.5`, `after:bg-white`, `after:rounded-full`, `after:h-5`, `after:w-5`, `after:transition-transform`, `bg-blue-600`, `after:translate-x-5`

**Testes:**
- PWA instalada + permissão concedida → notificações agendadas.
- Sem PWA → toggle de notificações não aparece.
- Notificação no momento certo com texto correto.
- Máximo de 3 por dia.
- Desativar toggle cancela notificações.
- Re-abrir app re-agenda corretamente.

---

#### 4.6. Compartilhar Comparativo de Preços

**Problema:** Querer discutir com o parceiro onde vale a pena comprar.

**Solução:**
- Na tela Comparar, botão "Compartilhar resumo".
- Gera texto formatado:
  ```
  📊 Comparativo de Preços — Último Mês

  🍚 Arroz 5kg
  Mais barato: Atacarejo R$ 22,90
  Mais caro: Supermercado R$ 26,50

  🥛 Leite 1L
  Mais barato: Feira R$ 4,50
  Mais caro: Atacarejo R$ 4,80

  ---
  Total no mês:
  Atacarejo: R$ 450,00 (3 compras)
  Feira: R$ 120,00 (4 compras)
  Supermercado: R$ 280,00 (2 compras)
  ```
- Usa Web Share API. Fallback: clipboard.

**Schema:** Nenhuma mudança.

**Testes:**
- Texto gerado corretamente com dados reais.
- Web Share API funciona em mobile.
- Fallback clipboard no desktop.
- Produtos sem comparação (comprados em 1 mercado só) são omitidos ou marcados "sem comparação".

---

## Guia de Execução por Onda

> **Nota (31/08/2026):** o projeto agora é um repositório git e o arquivo do app chama-se
> `MercadoDoCasal.html` (era `MercadoDoCasal-corrigido.html`, na linha 361 desde que o Quagga
> entrou na 360). O passo a passo abaixo foi escrito com o nome e a linha antigos e com cópias
> `.bak` — hoje, "criar backup" = `git commit`, "reverter" = `git checkout`.

### Antes de cada onda
1. `git commit` do estado bom (ponto de retorno).
2. Listar todas as âncoras de string que serão usadas e confirmar unicidade com `grep -c "âncora" arquivo`.
3. Listar todas as classes Tailwind novas e adicioná-las de uma vez na linha 11 (auditar depois com `grep -o "class-name" arquivo | wc -l` vs. CSS).

### Durante cada onda
1. Aplicar patches de trás para frente (maior offset primeiro).
2. Após **cada** patch individual:
   ```bash
   sed -n '361p' MercadoDoCasal.html | sed 's/^<script>//; s|</script>$||' > /tmp/app.js && node --check /tmp/app.js
   ```
3. Verificar `wc -c` do arquivo cresceu o esperado.

### Após cada onda
1. Rodar todos os testes da onda + testes de regressão das ondas anteriores.
2. Testar migração: criar banco v1 sintético, abrir o app, verificar que chegou à versão atual sem erro.
3. Testar restore de backup v2: garantir compatibilidade.
4. Testar mobile 375px: `document.scrollWidth === clientWidth`.
5. Console limpo em todos os cenários.
6. `git commit` da onda concluída. Publicar (ver `INSTALAR-PWA.md`) se for para o ar.

---

## Riscos Globais e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Tailwind faltando | UI invisível/quebrada | Auditoria obrigatória de toda classe nova vs. CSS na linha 11 |
| Identificador colidindo | Comportamento imprevisível | Nomes descritivos novos (`barcode`, `buyer`, `changeLog`); evitar letras soltas já listadas em CLAUDE.md |
| IndexedDB DataError | App não abre | `active` sempre `0`/`1`; `null` nunca indexado; testar migration com banco real |
| Arquivo crescer demais | Load lento em mobile | Monitorar `wc -c`; se passar de 2 MB, avaliar extrair CSS/JS para arquivos separados (mudança de arquitetura) |
| Browser não suporta API | Funcionalidade invisível | Feature detection para todas as APIs nativas (Speech, Barcode, File System, Compression, Web Share) |
| PWA inline não funciona | Não instalável | Fallback: tutorial "Adicionar à Tela Inicial" no iOS |
| Sync por pasta falha silenciosamente | Dados desatualizados | Mostrar status de sync ("Sync ativo · Último: DD/MM HH:MM" ou "Sync com erro") |
```

Salva esse conteúdo como `PLANO-EVOLUCAO.md` na raiz do projeto. Cada onda pode ser executada de forma independente, desde que na ordem (dependências explícitas: onda 2 depende da 1, onda 3 da 2, onda 4 da 3).