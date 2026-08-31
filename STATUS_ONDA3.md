# Status da Onda 3 — concluída

Atualizado em: 31/08/2026

A Onda 3 do `melhorias.md` está fechada. Este documento registra o corte final e o
resultado da validação. As peças foram entregues em três blocos, o último dos quais
(vínculo de EAN + Comparador vivo) começou por outro agente e foi finalizado e
validado nesta sessão.

## Entregue e validado no navegador

### Consulta local por EAN

- Consulta de código de barras exclusivamente na base local do aparelho, sem APIs
  nem pesquisas externas.
- Entrada manual do código disponível mesmo sem leitura por câmera.
- Leitura pela câmera quando `BarcodeDetector` e `getUserMedia` são suportados.
- Normalização do código e validação indicativa do dígito verificador para GTIN-8,
  GTIN-12, GTIN-13 e GTIN-14. Código suspeito recebe aviso mas ainda é procurado.
- Resultado contextual conforme a tela de origem: abrir cadastro existente, adicionar
  à lista, adicionar ao registro de compra, ou oferecer cadastro com o EAN preenchido.

### Vínculo de EAN a produto existente

Quando a consulta não encontra o código, além de "Cadastrar produto novo" aparece
**"Vincular a produto existente"**. Ele abre o `ProductPicker`; ao escolher um produto,
o EAN é gravado no `barcode` daquele produto e a consulta é refeita, já mostrando o
produto agora encontrado.

Validado: vínculo grava o `barcode`; conflito (produto já tem outro `barcode`) exibe
`confirm()` e, se recusado, não altera nada; após vincular, o modal retorna à consulta
com o produto encontrado. Funciona a partir de Produtos, Lista e Registrar.

### Comparador vivo

A tela Comparar foi reescrita. `buildPriceIndex` passou a acumular, por produto e por
mercado, estatísticas completas (contagem, soma, mínimo, máximo, último preço e data,
série de pontos, média dos últimos 90 dias). Sobre isso:

- **Base da comparação:** três modos — preço mais recente, média de 90 dias, recorde
  histórico. O rótulo e o texto de apoio de cada seção acompanham o modo.
- **Comparar minha lista:** escolhida uma lista ativa, o app estima a cesta em cada
  mercado. Mostra a melhor opção em uma loja (com % de cobertura de preços locais) e,
  se compensar, uma divisão em duas paradas com a atribuição item a item. Item sem
  preço em nenhum lugar nunca é tratado como grátis — entra por estimativa global e a
  cobertura é informada.
- **Perfil dos mercados:** ticket médio, nº de compras, última compra, quantas
  comparações cada mercado vence e marca de "frequentemente falta item".
- **Onde vale a pena comprar:** por produto com preço em ≥ 2 mercados — melhor e pior
  mercado, diferença em R$ e %, tendência entre as duas últimas compras (↗/↘), idade
  do melhor preço com aviso de "preço antigo" acima de 90 dias. Busca, ordenação
  (economia / percentual / nome) e filtros (na lista, abaixo da meta, subiu, preço
  antigo). Ao abrir um item: sparkline por mercado, detalhamento e escolha do mercado
  preferido (`products.preferredStoreId`).
- **Comparar embalagens:** produtos com o mesmo **Grupo comparável** (`comparisonGroup`,
  campo novo no cadastro do produto) são comparados pelo preço por kg, litro ou unidade,
  normalizado pela `packageSize`/`packageUnit`.
- **Compartilhar:** resumo em texto (Web Share ou área de transferência) com a cesta,
  a divisão e as maiores diferenças.

### Demais peças da Onda 3 (já entregues antes, revalidadas)

- **Calendário:** tela mensal com cores por mercado, projeções pelos intervalos reais
  e modal com os itens da compra.
- **Auto-backup:** até 3 cópias locais, uma por dia.
- **Editar/excluir compra:** com desfazer.
- **Teclado na Lista:** foco, Enter/Espaço alterna comprado, Delete/Backspace remove
  com desfazer, setas movem o foco.
- **Pós-compra:** avaliação opcional, marcação de itens não encontrados, histórico por
  produto/mercado e badge no Comparador após recorrência.

## Verificação desta sessão

O Comparador vivo já estava no arquivo quando esta sessão começou, com um `)` faltando
na função `Compare` (já corrigido pelo agente anterior). A revisão desta sessão:

- **Sintaxe:** `node --check` do script do app passa.
- **Schema:** `db.version(1)` a `(4)`, cada uma exatamente uma vez com `.stores`. O
  Comparador vivo e o vínculo de EAN não mexeram no schema — `comparisonGroup` e
  `preferredStoreId` são campos não indexados.
- **CSS:** auditoria contra todos os blocos `<style>`. Duas classes novas do patch
  estavam sem regra no bundle pré-compilado e foram acrescentadas à linha 11:
  - `.inline-block{display:inline-block}` (badge "frequentemente falta item");
  - `.border-blue-200{border-color:rgb(191 219 254)}` (borda do filtro ativo).
- **Formatação:** `compartilhar` montava o texto com `linhas.join("")` — a minificação
  do patch tinha comido o `\n`. Corrigido para `linhas.join(String.fromCharCode(10))`;
  o resumo compartilhado volta a ter quebras de linha.
- **Navegador:** base de teste com 92 produtos, 8 mercados, ~28 compras cobrindo preço
  recente/antigo, mesmo produto em 2–3 mercados, cobertura parcial e grupos comparáveis.
  Exercitados: os três modos de base, a cesta em uma loja e dividida, o perfil dos
  mercados, os filtros, abrir item / sparkline / mercado preferido, o compartilhar, o
  campo Grupo comparável no cadastro, e o fluxo completo de vínculo de EAN (inclusive
  conflito e retorno). Console limpo do boot ao fim; em 375 px sem overflow horizontal;
  as sete demais telas abrem sem erro.

## Observações deixadas (decisão de produto, não corrigidas)

- Mercados sem nenhum preço local da lista aparecem na tabela da cesta com um total
  quase inteiramente estimado (ex.: "0/8 preços locais · R$ 172,68"). A linha diz a
  cobertura e a ordenação nunca os coloca como melhor opção, mas o número pode
  confundir à primeira vista.
- `vincular` lê o produto de `e.productById` com fallback para o banco. Se o estado do
  React estiver desatualizado, a checagem de conflito de `barcode` pode não disparar.
  No fluxo real o estado está sempre sincronizado por `e.reload()`; só reproduzível
  mutando o IndexedDB por fora.
