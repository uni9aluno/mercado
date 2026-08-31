# Instalar o Mercado do Casal como aplicativo (PWA)

## O app está publicado

**<https://uni9aluno.github.io/mercado/>**

Repositório: <https://github.com/uni9aluno/mercado> (público, conta `uni9aluno`).
GitHub Pages serve a pasta `main` / raiz, com HTTPS.

Abrir o `MercadoDoCasal.html` direto do gerenciador de arquivos (`file://`) continua
funcionando para quase tudo, **menos a câmera** — navegadores bloqueiam o acesso à
câmera em `file://`. Pelo endereço HTTPS acima, o leitor de código de barras pela
câmera funciona.

| | `file://` (arquivo local) | pelo endereço HTTPS / PWA instalado |
|---|---|---|
| Lista, gastos, comparador, backup | ✅ | ✅ |
| Funciona offline | ✅ | ✅ (depois da 1ª abertura) |
| Digitar código de barras | ✅ | ✅ |
| **Ler código pela câmera** | ❌ | ✅ |
| Ícone próprio / tela cheia | ❌ | ✅ |

Os dados ficam **só no aparelho** (IndexedDB) nos dois casos. Não há conta nem nuvem.
O backup JSON é a única forma de levar os dados para outro aparelho.

---

## Instalar no Android (Chrome)

1. Abrir **<https://uni9aluno.github.io/mercado/>** no Chrome.
2. Usar o app por alguns segundos (o Chrome espera uma interação antes de oferecer a
   instalação).
3. Menu **⋮** → **Instalar aplicativo** (ou **Adicionar à tela inicial** → **Instalar**).
4. Confirmar. O ícone do "Mercado" aparece na tela inicial e na gaveta de apps.
5. Abrir pelo ícone — abre em tela cheia, sem a barra do Chrome.

### Permitir a câmera

Na primeira vez que tocar em **Escanear com a câmera** (tela Produtos → "Consultar
código", ou no cadastro de um produto), o Android pede permissão. Toque em **Permitir**.
Se negar sem querer: **Configurações do Android → Aplicativos → Mercado → Permissões →
Câmera → Permitir**.

Se a câmera ainda assim não abrir, a própria tela de "Consultar código" passa a
explicar o motivo em vez de esconder o botão.

---

## Instalar no PC (Chrome ou Edge)

1. Abrir <https://uni9aluno.github.io/mercado/>.
2. Na barra de endereço, à direita, o ícone de **instalar** (um monitor com seta para
   baixo). Clicar.
   - Alternativa: menu **⋮** → **Instalar Mercado do Casal…**
3. O app abre em janela própria, com ícone no menu Iniciar / Launchpad.

---

## Publicar uma atualização

`X:\Mercado` é um repositório git local (sem remote — o desenvolvimento fica só aqui).
O **repositório publicado** é o `uni9aluno/mercado`, separado, com só os arquivos do
site. O clone dele já está em **`C:\Users\Heimdall\mercado-pub`** (se sumir, refazer
com `git -c http.sslBackend=schannel clone https://github.com/uni9aluno/mercado.git`).

A cada atualização, do Git Bash:

```bash
cd /x/Mercado && git commit -am "..."                          # 1. versionar no projeto
cp MercadoDoCasal.html manifest.json sw.js ~/mercado-pub/      # 2. copiar o que mudou
cd ~/mercado-pub && git commit -am "Atualizar app" && git push # 3. publicar
```

(No Git Bash, `~` é `C:\Users\Heimdall` e `/x/Mercado` é `X:\Mercado`.)

> O `-c http.sslBackend=schannel` é obrigatório nesta rede (o proxy usa um certificado
> próprio que o OpenSSL do Git recusa). Já está no `git config --global`, então um
> `git push` simples também funciona — o `-c` explícito é só um lembrete.

Em ~1 minuto o GitHub Pages reconstrói. O service worker é *network-first*: quem está
online pega a versão nova no próximo acesso; quem está offline continua com a última
que baixou. Ao subir uma atualização, o app mostra uma barra "atualizar" para quem já
tinha aberto antes.

> **Atenção ao `sw.js`:** ao trocar o nome do arquivo do app ou mexer no que é
> cacheado, subir a versão do `CACHE` (`mercado-do-casal-vN`) para forçar a limpeza do
> cache antigo nos aparelhos. Foi feito na v1→v2 (renomeação do arquivo).

### Só o necessário para o site

O repositório publicado tem apenas: `MercadoDoCasal.html`, `index.html` (redireciona a
raiz para o app), `manifest.json`, `sw.js`, `.gitattributes` (força LF — o HTML
minificado depende disso) e um `README.md` curto. Os documentos internos de
desenvolvimento (`CLAUDE.md`, `HANDOFF.md`, `AGENTES.md`, `melhorias.md`,
`STATUS_ONDA3.md`) **não** vão para lá.

---

## Nota sobre o domínio da conta

A conta `uni9aluno` tinha um domínio customizado `gabriellunaro.me` configurado num
repo `uni9aluno.github.io` (arquivo `CNAME`, de 2024). Esse domínio **expirou** e
passou a redirecionar todos os GitHub Pages da conta para um host inexistente. O
`CNAME` foi removido para destravar `https://uni9aluno.github.io/`. Se um dia esse
domínio voltar a ser usado, recolocar o `CNAME` **só** no repo que deve responder por
ele — não deixá-lo valendo para a conta inteira.

---

## Alternativa sem GitHub: Netlify Drop

Se preferir não usar o GitHub Pages: <https://app.netlify.com/drop> — arrastar a pasta
com `MercadoDoCasal.html`, `index.html`, `manifest.json` e `sw.js`. O site sobe na hora
num endereço `https://ALGO.netlify.app`. Criar conta gratuita depois para manter o
endereço e poder atualizar.
