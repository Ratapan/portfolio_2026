// URLs de imagen vía Cloudflare Image Transformations.
//
// Las fotos viven en el bucket público servido en assets.javiersabando.lat; la
// transformación se pide en la misma zona:
//   https://assets.javiersabando.lat/cdn-cgi/image/<opciones>/<key>
// `onerror=redirect` es la red de seguridad: si la transformación falla, el
// navegador recibe un 307 al archivo original en vez de un error.
//
// Cuota gratuita: 5.000 transformaciones únicas cada 30 días. Por eso los
// anchos son un set fijo (y no uno por componente): cada foto cuesta como
// máximo WIDTHS.length transformaciones.

export const ASSETS_BASE = "https://assets.javiersabando.lat";

/** Anchos del srcset. Los WebP publicados miden como máximo 2560 px. */
export const WIDTHS = [480, 960, 1600, 2560] as const;

// AVIF no se acepta como origen (error 9520), y SVG/GIF no tienen sentido.
const TRANSFORMABLE = /\.(webp|jpe?g|png)$/i;

/** ¿Se puede pedir esta URL a Transformations? */
export function isTransformable(url: string): boolean {
  return url.startsWith(`${ASSETS_BASE}/`) && TRANSFORMABLE.test(url);
}

/** URL transformada a `width` px (formato automático: AVIF/WebP según el navegador). */
export function cfImage(url: string, width: number): string {
  if (!isTransformable(url)) return url;
  const key = url.slice(ASSETS_BASE.length + 1);
  return `${ASSETS_BASE}/cdn-cgi/image/width=${width},format=auto,onerror=redirect/${key}`;
}

/**
 * Anchos útiles para una foto de `naturalWidth` px: los de WIDTHS menores a
 * ella, más su propio ancho como tope (Transformations no agranda).
 */
export function widthsFor(naturalWidth: number | undefined): number[] {
  if (!naturalWidth) return [...WIDTHS];
  const below = WIDTHS.filter((w) => w < naturalWidth);
  return [...below, Math.min(naturalWidth, WIDTHS[WIDTHS.length - 1])];
}

export function srcset(url: string, naturalWidth: number | undefined): string | undefined {
  if (!isTransformable(url)) return undefined;
  return widthsFor(naturalWidth)
    .map((w) => `${cfImage(url, w)} ${w}w`)
    .join(", ");
}
