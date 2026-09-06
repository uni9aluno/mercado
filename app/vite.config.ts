import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// O app é publicado em https://uni9aluno.github.io/mercado/ — subpath fixo do GitHub Pages.
// Só o build de produção precisa do prefixo /mercado/; em dev servimos na raiz para
// simplificar o preview local.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/mercado/" : "/",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/icon-512-maskable.png"],
      manifest: {
        name: "Mercado do Casal",
        short_name: "Mercado",
        description: "Lista de compras e controle de gastos do casal",
        start_url: "/mercado/",
        scope: "/mercado/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#059669",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache de todo o build — o app abre offline. Só EAN e foto exigem rede.
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        // O bundle tem o app inteiro + libs; o limite padrão (2 MiB) é apertado.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/mercado/index.html",
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
}));
