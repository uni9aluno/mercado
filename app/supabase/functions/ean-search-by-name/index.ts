// ===========================================================================
//  Edge Function — busca de produto por NOME no catálogo online, usada pelo
//  autocomplete do ProductForm (só quando há conta/login — ver
//  src/integrations/eanCatalog.ts, searchEanByName).
//
//  Por quê uma function e não chamar o Open Food Facts direto do navegador:
//  a busca textual de verdade do OFF (search.openfoodfacts.org,
//  "search-a-licious") não envia Access-Control-Allow-Origin — um fetch()
//  de outra origem é bloqueado por CORS. O endpoint antigo que tem CORS
//  liberado (world.openfoodfacts.org/api/v2/search) não filtra por texto de
//  verdade. Servidor-a-servidor (aqui) não tem restrição de CORS nenhuma.
//
//  Exige sessão (verify_jwt, padrão do projeto): consistente com o resto do
//  catálogo online no modo com conta (ver ean_catalog_conta.sql). Sem conta,
//  o app nem chama esta function — fica só com a busca por EAN.
// ===========================================================================

const OFF_SEARCH_URL = "https://search.openfoodfacts.org/search";

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const termo = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (termo.length < 3) {
    return Response.json({ products: [] }, { headers: cors });
  }

  const url =
    OFF_SEARCH_URL +
    "?q=" +
    encodeURIComponent(termo) +
    "&page_size=8&langs=pt&fields=code,product_name,brands,quantity,image_front_small_url";

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return Response.json({ products: [] }, { headers: cors });

    const body = await res.json();
    const hits = Array.isArray(body?.hits) ? body.hits : [];
    const products = hits
      .filter((h: Record<string, unknown>) => h.code && h.product_name)
      .map((h: Record<string, unknown>) => ({
        code: h.code,
        product_name: h.product_name,
        brands: Array.isArray(h.brands) ? (h.brands[0] ?? "") : (h.brands ?? ""),
        quantity: h.quantity ?? "",
        image_front_small_url: h.image_front_small_url ?? null,
      }));
    return Response.json({ products }, { headers: cors });
  } catch {
    return Response.json({ products: [] }, { headers: cors });
  }
});
