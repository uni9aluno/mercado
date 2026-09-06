# Instalar e publicar o Mercado do Casal

## Aplicativo publicado

**<https://uni9aluno.github.io/mercado/>**

O app é uma PWA. Depois da primeira abertura, o build fica disponível offline. Os
dados do casal continuam somente no IndexedDB de cada navegador; para levá-los a
outro aparelho, use o backup JSON da tela Config.

Quem já usava a versão antiga na mesma URL não precisa exportar/importar nada: na
primeira abertura da versão nova, o banco `MercadoDB` é migrado automaticamente da
v4 para a v5. O caminho antigo `MercadoDoCasal.html` permanece como redirecionamento
de compatibilidade para instalações existentes.

| Recurso | Navegador HTTPS | PWA instalada |
|---|---:|---:|
| Lista, gastos, comparador e backup | ✅ | ✅ |
| Uso offline após a primeira abertura | ✅ | ✅ |
| Digitar código de barras | ✅ | ✅ |
| Ler código pela câmera | ✅ | ✅ |
| Ícone próprio e tela cheia | — | ✅ |

## Instalar no Android (Chrome)

1. Abra <https://uni9aluno.github.io/mercado/> no Chrome.
2. Use o menu **⋮ → Instalar aplicativo** (ou **Adicionar à tela inicial → Instalar**).
3. Abra pelo ícone criado.
4. Ao usar **Escanear com a câmera** pela primeira vez, permita o acesso à câmera.

Se a permissão foi negada: **Configurações do Android → Aplicativos → Mercado →
Permissões → Câmera → Permitir**.

## Instalar no PC (Chrome ou Edge)

1. Abra <https://uni9aluno.github.io/mercado/>.
2. Clique no ícone de instalação à direita da barra de endereço.
3. Confirme **Instalar**.

## Publicar uma atualização

O repositório é <https://github.com/uni9aluno/mercado>. Um push para `main` dispara
`.github/workflows/deploy.yml`, que executa `npm ci`, lint, os testes, o build Vite
e publica `app/dist` no GitHub Pages.

Antes de enviar:

```powershell
cd X:\Mercado\app
npm run lint
npm test
npm run build
```

Depois, versionar e publicar a partir de `X:\Mercado`:

```powershell
git add -A
git commit -m "Descrição da atualização"
git push origin main
```

Nesta rede, se o certificado do proxy impedir o push, use:

```powershell
git -c http.sslBackend=schannel push origin main
```

O catálogo EAN online é opcional e não faz parte do deploy. Para configurá-lo, veja
[app/docs/SUPABASE.md](app/docs/SUPABASE.md).

## Observação sobre o domínio da conta

O domínio antigo `gabriellunaro.me` expirou e não deve ser configurado como `CNAME`
global da conta `uni9aluno`, pois isso redireciona indevidamente os GitHub Pages.
