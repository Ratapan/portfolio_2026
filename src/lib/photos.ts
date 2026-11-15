// Consultas sobre la colección `photos` (ya filtrada a visible:true en el loader).
import { getCollection } from "astro:content";
import type { PhotoData } from "../content.config";
import { t, type Locale } from "../i18n";

export type Photo = PhotoData & { id: string };

let cache: Photo[] | null = null;

/** Todas las fotos visibles, más recientes primero. */
export async function getPhotos(): Promise<Photo[]> {
  if (!cache) {
    const entries = await getCollection("photos");
    cache = entries
      .map((e) => ({ ...e.data, id: e.id }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return cache;
}

/** Fotos del portafolio ordenadas por "mejores" (estrellas, luego recientes). */
export async function getFeatured(limit?: number): Promise<Photo[]> {
  const ranked = (await getPhotos())
    .filter((p) => p.portfolio)
    .sort((a, b) => b.stars - a.stars || b.createdAt.getTime() - a.createdAt.getTime());
  return limit ? ranked.slice(0, limit) : ranked;
}

export function caption(photo: Photo, locale: Locale): string | undefined {
  return locale === "en" ? photo.caption_en || photo.caption : photo.caption || photo.caption_en;
}

/** Texto alternativo: el caption del idioma; si no hay, uno genérico con la categoría. */
export function altFor(photo: Photo, locale: Locale): string {
  const text = caption(photo, locale);
  if (text) return text;
  const base = t(locale, "photo.altFallback");
  return photo.category ? `${base} · ${photo.category}` : base;
}

export function isLandscape(photo: Photo): boolean {
  return !!photo.width && !!photo.height && photo.width > photo.height;
}
