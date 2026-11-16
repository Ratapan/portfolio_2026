// Textos y rutas por idioma. Español en la raíz (/sobre-mi/) e inglés bajo
// /en/ (/en/about/): los slugs cambian por idioma, así que el mapa de rutas
// vive aquí en vez de derivarse de la estructura de archivos.
import es from "./es.json";
import en from "./en.json";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

const dictionaries: Record<Locale, unknown> = { es, en };

export function asLocale(value: string | undefined): Locale {
  return value === "en" ? "en" : "es";
}

/** Valor crudo de una clave con puntos ("about.xp"); undefined si no existe. */
export function raw(locale: Locale, key: string): unknown {
  let node: unknown = dictionaries[locale];
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** Texto traducido con interpolación {var}. Si falta, devuelve la clave (se nota). */
export function t(
  locale: Locale,
  key: string,
  vars: Record<string, string | number> = {},
): string {
  const value = raw(locale, key);
  if (typeof value !== "string") return key;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/** Rutas de cada sección por idioma (siempre con barra final). */
export const ROUTES = {
  home: { es: "/", en: "/en/" },
  portfolio: { es: "/portafolio/", en: "/en/portfolio/" },
  collections: { es: "/colecciones/", en: "/en/collections/" },
  articles: { es: "/articulos/", en: "/en/articles/" },
  projects: { es: "/proyectos/", en: "/en/projects/" },
  about: { es: "/sobre-mi/", en: "/en/about/" },
  commissions: { es: "/encargos/", en: "/en/commissions/" },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteName = keyof typeof ROUTES;

/**
 * Navegación principal. `ready` = la sección ya existe en v2; las demás se
 * activan en su fase para no enlazar a páginas que todavía dan 404.
 */
export const NAV: { route: RouteName; ready: boolean; accent?: boolean }[] = [
  { route: "portfolio", ready: true },
  // Se muestra solo si hay colecciones publicadas (ver Header.astro).
  { route: "collections", ready: true },
  { route: "articles", ready: true },
  // Se muestra solo si hay proyectos publicados (ver Header.astro).
  { route: "projects", ready: true },
  { route: "about", ready: true },
  { route: "commissions", ready: false, accent: true },
];

export function otherLocale(locale: Locale): Locale {
  return locale === "es" ? "en" : "es";
}
