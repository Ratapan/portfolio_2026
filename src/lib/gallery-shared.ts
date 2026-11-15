// Tipos y lógica de la galería que corren tanto en el build como en el
// navegador (isla GalleryExplorer). Sin dependencias de Astro ni de Node.

/**
 * Foto pública de la galería, con claves cortas porque viaja en /data/photos.json.
 * No lleva `stars` (curaduría privada): solo `best`, su puesto en el orden "Mejores".
 */
export interface GPhoto {
  id: string;
  url: string;
  w?: number;
  h?: number;
  /** Color promedio "#rrggbb" (placeholder). */
  c?: string;
  cap?: string;
  capEn?: string;
  foot?: string;
  footEn?: string;
  focal?: string;
  /** Focal en mm para ordenar (derivada del texto si falta en el doc). */
  fmm?: number;
  ap?: number;
  iso?: number;
  ss?: string;
  cam?: string;
  lens?: string;
  cats: string[];
  sess?: string;
  /** En el portafolio (filtro "Solo destacadas"). */
  pf?: true;
  /** Fecha de alta (ms) para "Recientes". */
  t: number;
  /** Puesto en "Mejores" (0 = la mejor). */
  best: number;
}

export interface FacetItem {
  value: string;
  count: number;
}

export interface CategoryGroup {
  /** Categoría amplia (tag sin parent); "" = categorías sin grupo conocido. */
  parent: string;
  slug: string;
  categories: FacetItem[];
  count: number;
}

export interface Range {
  min: number | null;
  max: number | null;
}

export interface Facets {
  categoryGroups: CategoryGroup[];
  cameras: FacetItem[];
  lenses: FacetItem[];
  sessions: FacetItem[];
  iso: Range;
  apertura: Range;
  total: number;
}

export const SORTS = ["recientes", "estrellas", "focal"] as const;
export type Sort = (typeof SORTS)[number];

/** Filtros de la galería. Mismas claves de URL que portfolio_2025 (los links viejos siguen sirviendo). */
export interface Filters {
  search: string;
  categories: string[];
  camera: string;
  lens: string;
  session: string;
  portfolio: boolean;
  sort: Sort;
  isoMin?: number;
  isoMax?: number;
  apMin?: number;
  apMax?: number;
}

export function emptyFilters(): Filters {
  return {
    search: "",
    categories: [],
    camera: "",
    lens: "",
    session: "",
    portfolio: false,
    sort: "recientes",
  };
}

const num = (v: string | null): number | undefined => {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function filtersFromParams(params: URLSearchParams): Filters {
  const sort = params.get("sort");
  return {
    search: params.get("search") ?? "",
    categories: (params.get("categories") ?? "").split(",").filter(Boolean),
    camera: params.get("camera") ?? "",
    lens: params.get("lens") ?? "",
    session: params.get("session") ?? "",
    portfolio: params.get("portfolio") === "true",
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : "recientes",
    isoMin: num(params.get("isoMin")),
    isoMax: num(params.get("isoMax")),
    apMin: num(params.get("apMin")),
    apMax: num(params.get("apMax")),
  };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.search.trim()) p.set("search", f.search.trim());
  if (f.categories.length) p.set("categories", f.categories.join(","));
  if (f.camera) p.set("camera", f.camera);
  if (f.lens) p.set("lens", f.lens);
  if (f.session) p.set("session", f.session);
  if (f.portfolio) p.set("portfolio", "true");
  if (f.sort !== "recientes") p.set("sort", f.sort);
  for (const key of ["isoMin", "isoMax", "apMin", "apMax"] as const) {
    if (f[key] !== undefined) p.set(key, String(f[key]));
  }
  return p;
}

export function hasActiveFilters(f: Filters): boolean {
  return filtersToParams(f).toString() !== "";
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Aplica filtros y orden. `scope` restringe a un grupo (páginas por categoría). */
export function applyFilters(all: GPhoto[], f: Filters, scope?: string[]): GPhoto[] {
  const q = fold(f.search.trim());
  const cats = new Set(f.categories);
  const scopeSet = scope ? new Set(scope) : null;
  const inRange = (v: number | undefined, min?: number, max?: number) =>
    (min === undefined && max === undefined) ||
    (v !== undefined && (min === undefined || v >= min) && (max === undefined || v <= max));

  const out = all.filter((p) => {
    if (scopeSet && !p.cats.some((c) => scopeSet.has(c))) return false;
    if (cats.size && !p.cats.some((c) => cats.has(c))) return false;
    if (f.camera && p.cam !== f.camera) return false;
    if (f.lens && p.lens !== f.lens) return false;
    if (f.session && p.sess !== f.session) return false;
    if (f.portfolio && !p.pf) return false;
    if (!inRange(p.iso, f.isoMin, f.isoMax)) return false;
    if (!inRange(p.ap, f.apMin, f.apMax)) return false;
    if (q) {
      const haystack = fold([p.cap, p.capEn, p.foot, p.footEn, ...p.cats].filter(Boolean).join(" "));
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  switch (f.sort) {
    case "estrellas":
      return out.sort((a, b) => a.best - b.best);
    case "focal":
      return out.sort(
        (a, b) => (a.fmm ?? Infinity) - (b.fmm ?? Infinity) || b.t - a.t,
      );
    default:
      return out.sort((a, b) => b.t - a.t);
  }
}

export function captionOf(p: GPhoto, locale: "es" | "en"): string {
  return (locale === "en" ? p.capEn || p.cap : p.cap || p.capEn) ?? "";
}

export function footerOf(p: GPhoto, locale: "es" | "en"): string {
  return (locale === "en" ? p.footEn || p.foot : p.foot || p.footEn) ?? "";
}

/** "50 mm · f/2.8 · 1/250 · ISO 160" */
export function exifLine(p: GPhoto): string {
  return [p.focal, p.ap && `f/${p.ap}`, p.ss, p.iso && `ISO ${p.iso}`].filter(Boolean).join(" · ");
}

export function ratioOf(p: GPhoto): number {
  return p.w && p.h ? p.w / p.h : 1.5;
}

export function slugify(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
