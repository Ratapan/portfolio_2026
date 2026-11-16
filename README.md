# portfolio_2026

Sitio público de javiersabando.lat: Astro 7 estático, desplegado en Vercel.
Las fotos y su metadata salen de Mongo (`rtp_blog`), que administra insta_bot.
Mongo se lee **solo al compilar**: el sitio publicado no habla con ninguna base de datos.
Lo único que corre en el servidor es la función del formulario de encargos (`api/encargos.ts`).

## Requisitos

- Node **≥ 22.23.4** (lo exige Astro 7; ver `.nvmrc`) y pnpm 10.17.
- `.env` con `MONGODB_URI` del usuario de solo lectura `portfolio_build` (ver `.env.example`).
  Las variables de encargos y analítica son opcionales en local (ver `.env.example`).

## Comandos

```bash
pnpm install
pnpm dev        # servidor de desarrollo
pnpm build      # genera dist/ (lee Mongo)
pnpm preview    # sirve dist/
pnpm check      # typecheck
```

## Cómo está armado

- `src/content.config.ts`: loaders que leen `images` (solo `visible: true`, sin `originalKey`), `tags`,
  `blogs` (artículos y proyectos publicados) y `collections` (colecciones publicadas).
  Un doc inválido se omite con un warning, sin romper el build.
- `src/lib/img.ts`: URLs de Cloudflare Image Transformations (`/cdn-cgi/image/…,onerror=redirect`).
  Los anchos son un set fijo para no gastar la cuota de 5.000 transformaciones únicas al mes.
- `src/components/Photo.astro`: foto responsive con `width`/`height` y el color promedio como placeholder.
- `src/i18n/`: textos es/en y el mapa de rutas por idioma (`/sobre-mi/` ↔ `/en/about/`).
- `src/styles/global.css`: paleta Gruvbox (oscuro por defecto, `.light` en `<html>` para el claro).
- `vercel.json`: barra final en las URLs y caché de un año para `/_astro/` y `/fonts/`.
  En Vercel, `MONGODB_URI` va como variable de entorno del proyecto (la usa el build).
  Las imágenes siguen pasando por Cloudflare: Transformations funciona en la zona de assets, no en el host del sitio.
- `api/encargos.ts`: Vercel Function (Node) del formulario de `/encargos/`. Valida, verifica Turnstile
  y envía el correo con Resend (Reply-To = el cliente). Va sin imports para que Vercel la compile sola;
  los tipos de sesión están repetidos de `src/lib/commissions.ts`. Variables en Vercel:
  `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `ENCARGOS_FROM`, `ENCARGOS_TO` y, para el build,
  `PUBLIC_TURNSTILE_SITE_KEY`. Se prueba en local llamando a `POST` con un `Request` (Node quita los tipos solo).
- `src/lib/seo.ts`: JSON-LD (Person, BlogPosting, ImageGallery). Sitemap con `@astrojs/sitemap`
  (los hreflang van en el `<head>`). `PUBLIC_CF_BEACON_TOKEN` activa Cloudflare Web Analytics.
- Publicar: insta_bot llama al Deploy Hook de Vercel («Publicar sitio») y el build vuelve a leer Mongo.

El plan completo y el estado por fase están en `docs/`.
