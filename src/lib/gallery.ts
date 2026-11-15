// Datos de la galería calculados en el build: fotos públicas (photos.json) y
// facets del panel de filtros. Reemplaza a /api/portfolio/photos y
// /api/portfolio/facets de portfolio_2025: aquí no hay consultas en runtime.
import { getCollection } from "astro:content";
import { getPhotos, type Photo } from "./photos";
import { cameraName } from "./gear";
import { slugify, type CategoryGroup, type Facets, type FacetItem, type GPhoto } from "./gallery-shared";

// Valores de relleno que no son datos reales (las bridge escriben "N/A").
const NOISE = new Set(["", "n/a", "na", "unknown", "-"]);
const clean = (v: string | undefined) => (v && !NOISE.has(v.trim().toLowerCase()) ? v.trim() : undefined);

function focalMm(p: Photo): number | undefined {
  if (p.focalMm) return p.focalMm;
  const n = parseFloat(p.focal ?? "");
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

let cache: GPhoto[] | null = null;

/** Todas las fotos visibles en formato público, más recientes primero. */
export async function galleryPhotos(): Promise<GPhoto[]> {
  if (cache) return cache;
  const photos = await getPhotos();
  // "Mejores": estrellas y luego recientes. Solo sale el puesto, no las estrellas.
  const ranked = [...photos].sort(
    (a, b) => b.stars - a.stars || b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const best = new Map(ranked.map((p, i) => [p.id, i]));

  cache = photos.map((p) => {
    const g: GPhoto = {
      id: p.id,
      url: p.url,
      w: p.width,
      h: p.height,
      c: p.color,
      cap: p.caption,
      capEn: p.caption_en,
      foot: p.footer,
      footEn: p.footer_en,
      focal: p.focal,
      fmm: focalMm(p),
      ap: p.apertura,
      iso: p.iso,
      ss: p.velocidad,
      cam: cameraName(p.camera),
      lens: clean(p.lens),
      cats: p.categories,
      sess: p.session ?? undefined,
      t: p.createdAt.getTime(),
      best: best.get(p.id) ?? 0,
    };
    if (p.portfolio) g.pf = true;
    // Sin claves undefined: el JSON queda más chico.
    return Object.fromEntries(Object.entries(g).filter(([, v]) => v !== undefined)) as unknown as GPhoto;
  });
  return cache;
}

function countBy(values: (string | undefined)[]): FacetItem[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function range(values: (number | undefined)[]) {
  const nums = values.filter((v): v is number => typeof v === "number");
  return nums.length ? { min: Math.min(...nums), max: Math.max(...nums) } : { min: null, max: null };
}

/**
 * Facets del panel. Las categorías en uso se agrupan bajo su categoría amplia
 * (tag sin parent) con la colección `tags` que administra insta_bot; las que no
 * están en `tags` caen en el grupo "" (Otras). Grupos por uso, de mayor a menor.
 */
export async function galleryFacets(): Promise<Facets> {
  const photos = await galleryPhotos();
  const tags = (await getCollection("tags")).map((e) => e.data);
  const parentOf = new Map(tags.map((t) => [t.name, t.parent]));
  const parents = new Set(tags.filter((t) => !t.parent).map((t) => t.name));

  const groups = new Map<string, FacetItem[]>();
  for (const item of countBy(photos.flatMap((p) => p.cats))) {
    const key = parents.has(item.value) ? item.value : (parentOf.get(item.value) ?? "");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  // Conteo de un grupo = fotos distintas con alguna de sus categorías.
  const categoryGroups: CategoryGroup[] = [...groups.entries()]
    .map(([parent, categories]) => {
      const values = new Set([parent, ...categories.map((c) => c.value)].filter(Boolean));
      return {
        parent,
        slug: parent ? slugify(parent) : "",
        categories,
        count: photos.filter((p) => p.cats.some((c) => values.has(c))).length,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    categoryGroups,
    cameras: countBy(photos.map((p) => p.cam)),
    lenses: countBy(photos.map((p) => p.lens)),
    sessions: countBy(photos.map((p) => p.sess)),
    iso: range(photos.map((p) => p.iso)),
    apertura: range(photos.map((p) => p.ap)),
    total: photos.length,
  };
}

/** Valores (parent + hijos en uso) de un grupo: el alcance de su página. */
export function groupValues(group: CategoryGroup): string[] {
  return [group.parent, ...group.categories.map((c) => c.value)].filter(Boolean);
}
