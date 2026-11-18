// @ts-check
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Sitio 100 % estático: Mongo se lee solo al compilar (src/content.config.ts).
// Lo único que corre en el servidor es la función api/encargos.ts (Vercel).
export default defineConfig({
  site: "https://javiersabando.lat",
  trailingSlash: "always",
  // El CSS va dentro del HTML: es uno solo (~8 KiB comprimido) y así el primer
  // render no espera otra petición (PageSpeed móvil: ~150 ms menos de FCP/LCP).
  build: { inlineStylesheets: "always" },
  integrations: [
    vue(),
    // Los hreflang ya van en el <head> de cada página (los slugs cambian por
    // idioma, así que el modo i18n del sitemap no sirve aquí).
    sitemap({ filter: (page) => !page.endsWith("/404/") }),
  ],
  i18n: {
    locales: ["es", "en"],
    defaultLocale: "es",
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
