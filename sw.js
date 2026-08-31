// Service worker do Mercado do Casal.
// Estrategia: network-first para navegacao e para o proprio HTML, com fallback para o cache.
// O motivo e simples: este app e um arquivo unico que muda inteiro a cada atualizacao. Servir do
// cache primeiro deixaria o casal preso numa versao velha ate o SW trocar de geracao. Com
// network-first, quem esta online sempre pega a versao publicada; quem esta offline continua
// abrindo a ultima versao que baixou. Os dados nunca passam por aqui: ficam no IndexedDB.
var CACHE = "mercado-do-casal-v2";

self.addEventListener("install", function (ev) {
  self.skipWaiting();
  ev.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(["./", "./MercadoDoCasal.html", "./manifest.json"]).catch(function () {});
  }));
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (ev) {
  if (ev.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (z) { return; }
  if (url.origin !== self.location.origin) return;

  var ehNavegacao = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0;

  ev.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (ehNavegacao) return caches.match("./MercadoDoCasal.html");
        return Response.error();
      });
    })
  );
});
