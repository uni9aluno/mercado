/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // A paleta do app atual gira em torno do verde-esmeralda (#059669 / emerald-600).
      // Tailwind já traz `emerald`; nada a acrescentar por ora.
    },
  },
  plugins: [],
};
