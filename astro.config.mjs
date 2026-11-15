// @ts-check
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";

// Sitio 100 % estático: Mongo se lee solo al compilar (src/content.config.ts).
export default defineConfig({
  site: "https://javiersabando.lat",
  trailingSlash: "always",
  integrations: [vue()],
  i18n: {
    locales: ["es", "en"],
    defaultLocale: "es",
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
