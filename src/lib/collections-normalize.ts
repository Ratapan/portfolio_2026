// Colecciones curadas (colección `collections`, la escribe insta_bot) en el
// build. Contrato: insta_bot/src/lib/portfolioSchema.ts (collectionInputSchema).
//   - Solo entran las publicadas, y de sus fotos solo las visible:true.
//   - Las fotos consecutivas de un mismo díptico/tríptico (`series` del doc de
//     images) se agrupan en una fila, ordenadas por series.order.
//   - Las intros son texto plano: un párrafo por bloque separado por línea en blanco.
import type { GPhoto } from "./gallery-shared";

export type CollectionItem = { type: "photo"; photo: GPhoto } | { type: "series"; photos: GPhoto[] };

export interface CollectionData {
  slug: string;
  title: string;
  titleEn?: string;
  intro: string[];
  introEn: string[];
  cover: GPhoto;
  photos: GPhoto[];
  items: CollectionItem[];
  order: number;
  updatedAt: Date;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const paragraphs = (v: unknown) =>
  str(v)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

/** Agrupa fotos consecutivas de la misma serie (díptico/tríptico) en una fila. */
export function groupSeries(photos: GPhoto[]): CollectionItem[] {
  const items: CollectionItem[] = [];
  for (const photo of photos) {
    const last = items[items.length - 1];
    if (photo.series && last?.type === "series" && last.photos[0].series?.id === photo.series.id) {
      last.photos.push(photo);
    } else if (photo.series && last?.type === "photo" && last.photo.series?.id === photo.series.id) {
      items[items.length - 1] = { type: "series", photos: [last.photo, photo] };
    } else {
      items.push({ type: "photo", photo });
    }
  }
  for (const item of items) {
    if (item.type === "series") item.photos.sort((a, b) => (a.series?.order ?? 0) - (b.series?.order ?? 0));
  }
  return items;
}

/**
 * Doc crudo → colección pública. `visiblePhoto` devuelve la foto solo si
 * existe y es visible; las demás se omiten. null si no queda ninguna.
 */
export function normalizeCollection(
  doc: Record<string, unknown>,
  visiblePhoto: (url: string) => GPhoto | undefined,
): CollectionData | null {
  const urls = Array.isArray(doc.photos) ? doc.photos.map(str).filter(Boolean) : [];
  const photos = [...new Set(urls)].map(visiblePhoto).filter((p): p is GPhoto => !!p);
  if (!photos.length) return null;
  const cover = visiblePhoto(str(doc.cover)) ?? photos[0];
  const updatedAt = doc.updatedAt instanceof Date ? doc.updatedAt : new Date(0);
  return {
    slug: str(doc.slug),
    title: str(doc.title),
    titleEn: str(doc.title_en) || undefined,
    intro: paragraphs(doc.intro),
    introEn: paragraphs(doc.intro_en),
    cover,
    photos,
    items: groupSeries(photos),
    order: typeof doc.order === "number" ? doc.order : 0,
    updatedAt,
  };
}
