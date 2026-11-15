# Línea base — portfolio_2025 (antes de v2)

Medido el 2026-11-12 (22:26 GMT-3) sobre producción (javiersabando.lat). Es la referencia para comparar en la fase 7.

## PageSpeed Insights (móvil)

Condiciones: Lighthouse 13.6, Moto G Power emulado, Slow 4G. No hay datos de campo (CrUX) por poco tráfico.

| Página | Perf | FCP | LCP | TBT | CLS | SI | Peso total |
|---|---|---|---|---|---|---|---|
| `/` | 85 | 1,0 s | 4,4 s | 20 ms | 0 | 2,8 s | 5.055 KiB |
| `/portafolio` | 75 | 0,9 s | **9,5 s** | 30 ms | 0 | 1,9 s | 9.093 KiB |
| `/blog/recorri-el-paque-tricao-y-esto-fue-lo-que-encontre` | 79 | 1,5 s | 5,4 s | 30 ms | 0,015 | 2,8 s | **14.183 KiB** |

En las tres páginas el problema es el **peso de las imágenes** y la **caché**, no el JS (TBT ≤ 30 ms):

- "Use efficient cache lifetimes": 3,3 / 6,1 / 9,5 MiB. Las imágenes de R2 salen con `Cache-Control: max-age=14400` (4 h).
- Las imágenes no tienen `width`/`height` explícitos. "Improve image delivery" ahorraría 1.453 KiB en `/`.
- Render-blocking de 90–450 ms, `font-display` de 40–290 ms y ~45 KiB de JS sin usar.
- Accesibilidad 83–90: contraste insuficiente y `<html>` sin `lang`.
- En `/`: falta `<title>` y meta description (SEO 83).
- El post registra errores en consola (Best Practices 96).

## Tiempos de respuesta reales desde Santiago

Medidos con curl, promedio de 3 peticiones.

| URL | TTFB promedio | TTFB mínimo |
|---|---|---|
| `/` | 1,53 s (la 1ª petición fue en frío) | 0,56 s |
| `/portafolio` | 0,77 s | 0,73 s |
| `/about` | 0,36 s | 0,33 s |
| `/api/blog/sliders` | 0,63 s | 0,59 s |
| `/api/portfolio/facets` | 0,48 s | 0,46 s |
| `/api/portfolio/photos?limit=24` | 0,53 s | 0,53 s |

La primera página de la galería (24 fotos a tamaño completo) pesa **7,8 MiB** solo en imágenes. Hay 95 fotos visibles en total.

## Infraestructura actual

- **Hosting**: Vercel. Con `X-Vercel-Id: gru1::iad1`, la petición entra por São Paulo y la función corre en Washington D.C. Como responde `Cache-Control: max-age=0` y `X-Vercel-Cache: MISS`, cada visita se renderiza de nuevo.
- **DNS**: Cloudflare (`ullis.ns.cloudflare.com`, `jack.ns.cloudflare.com`). El apex apunta a Vercel sin proxy (no hay `cf-ray`).
- **Assets**: `assets.javiersabando.lat` es R2 con dominio propio. Se cachea en el edge (`cf-cache-status: HIT`), pero el objeto no trae `Cache-Control` propio y Cloudflare le pone 4 h.
- **Image Transformations**: desactivado (`/cdn-cgi/image/…` responde 404).
- **Correo**: los MX apuntan a `eforward1..5.registrar-servers.com` (reenvío de email de Namecheap).
