# Medición v2 (fase 7)

Medido el 2026-11-17 (noche, GMT-3) sobre producción, ya en javiersabando.lat, con las mismas condiciones
que la [línea base](linea-base.md): PageSpeed Insights móvil (Lighthouse 13, Moto G Power emulado, Slow 4G).
Cada celda va como «antes → ahora».

## PageSpeed Insights (móvil)

| Página | Perf | FCP | LCP | TBT | CLS | SI | Peso total |
|---|---|---|---|---|---|---|---|
| `/` | 85 → **96** | 1,0 → 0,9 s | 4,4 → 2,7 s | 20 → 0 ms | 0 → 0 | 2,8 → 0,9 s | 5.055 → **953 KiB** |
| `/portafolio/` | 75 → **97** | 0,9 → 0,9 s | 9,5 → 2,6 s | 30 → 0 ms | 0 → 0 | 1,9 → 0,9 s | 9.093 → **1.363 KiB** |
| `/articulos/recorri-el-paque-tricao-y-esto-fue-lo-que-encontre/` | 79 → **93** | 1,5 → 0,9 s | 5,4 → 2,6 s | 30 → 0 ms | 0,015 → **0,121** | 2,8 → 0,9 s | 14.183 → **811 KiB** |

Accesibilidad, Buenas prácticas y SEO quedan en 100 en las tres páginas, salvo Accesibilidad 96 en
`/portafolio/` por el contraste de los conteos de los filtros. Antes eran 83–90, 96 y 83.

## Tiempos de respuesta reales desde Santiago

TTFB con curl, promedio de 3 peticiones. El HTML sale de la caché de Vercel en São Paulo (`X-Vercel-Cache: HIT`).

| URL | Antes | Ahora |
|---|---|---|
| `/` | 1,53 s (mín. 0,56 s) | 0,19 s |
| `/portafolio/` | 0,77 s | 0,19 s |
| `/sobre-mi/` (antes `/about`) | 0,36 s | 0,19 s |

## Lo que quedó fuera de meta y qué se corrigió

- **LCP de 2,6–2,7 s** (meta: menos de 2 s).
  - En el trace, la imagen del LCP llega a los ~0,3–0,4 s; el resto lo pone la simulación de Slow 4G.
  - En esa simulación la imagen comparte ancho de banda con las demás que se piden al inicio, porque Chrome
    adelanta las `loading="lazy"` cercanas a la pantalla, y además espera un CSS que bloquea el render.
- **CLS de 0,121 en el artículo.** La portada usaba `w-auto h-auto`, que anula el tamaño reservado por
  `width`/`height`: la caja medía 0 hasta que llegaba la imagen y el texto saltaba.

Correcciones, probadas en local antes de desplegar:

1. **CSS dentro del HTML** (`build.inlineStylesheets: "always"`). Es uno solo, de ~8 KiB comprimido, y así
   el primer render no espera otra petición. PageSpeed estimaba un ahorro de 120–190 ms.
2. **Variante de 720 px** en `WIDTHS` (`src/lib/img.ts`). Las fotos de 300–400 px CSS en móvil bajaban la
   de 960: PageSpeed lo marcaba como 141–435 KiB de más por página.
3. **Portada del artículo con ancho explícito**: `min(100%, 80vh × proporción)`, la misma fórmula del `sizes`.
   En local, CLS 0 en móvil y en escritorio.
4. **Contraste**: los conteos de los filtros ya no llevan `opacity-60`.

## Después de las correcciones

Medido el 2026-11-18 (madrugada, GMT-3), con el commit `4b67849` en producción. Cada página se midió dos veces,
porque la primera corrida tras un deploy que cambia las URLs de las imágenes sale más lenta: Cloudflare
transforma cada variante nueva en su primera petición. En frío, `/portafolio/` dio LCP 3,6 s. La tabla usa
la segunda corrida, con la caché caliente.

| Página | Perf | FCP | LCP | TBT | CLS | SI | Peso total |
|---|---|---|---|---|---|---|---|
| `/` | 96 → **97** | 0,9 s | 2,7 → 2,6 s | 0 ms | 0 | 0,9 s | 953 → **814 KiB** |
| `/portafolio/` | 97 → **97** | 0,9 s | 2,6 → 2,6 s | 0 ms | 0 | 0,9 s | 1.363 → **1.180 KiB** |
| `/articulos/recorri-el-paque-tricao-y-esto-fue-lo-que-encontre/` | 93 → **98** | 0,9 s | 2,6 → **2,4 s** | 0 ms | 0,121 → **0** | 0,9 s | 811 → **661 KiB** |

En escritorio la home da 100, con LCP de 0,7 s.

- **El CLS del artículo quedó resuelto**, y la variante de 720 px bajó el peso entre un 13 % y un 19 %.
- **El LCP móvil sigue en 2,4–2,6 s**, sobre la meta de 2 s.
  - Ya no hay CSS que bloquee el render. Lo que queda es la simulación de Slow 4G repartiendo el ancho de
    banda entre la imagen del LCP y las demás que se piden al inicio. En el trace real la imagen llega a
    los ~0,2–0,4 s.
  - Bajar de 2 s en laboratorio pediría menos fotos cerca del inicio en móvil (por ejemplo, menos
    destacadas en la home). Es una decisión de diseño y no se tomó.
  - La medida que importa es la de visitantes reales: Cloudflare Web Analytics → Core Web Vitals, cuando
    haya datos.
- PageSpeed aún marca 176–252 KiB de imágenes más grandes de lo necesario en las filas justificadas. Su
  `sizes` reserva 1,5× por si la fila se estira para llenar el ancho; bajarlo dejaría borrosas las fotos de
  las filas que sí se estiran.
- **Accesibilidad 96 en `/portafolio/`.** El botón «Cargar más» (`.btn`) daba 3,96:1 en el tema oscuro.
  Corregido después de esta medición: `.btn` usa `font1`, y su hover toma los colores de `.btn-accent`. El
  hover anterior daba 2,4:1 en oscuro y 2,0:1 en claro.
