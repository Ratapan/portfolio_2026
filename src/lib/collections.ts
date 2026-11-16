// Colecciones curadas publicadas (colección de contenido `curated`).
import { getCollection } from "astro:content";
import type { CollectionData } from "./collections-normalize";
import type { Locale } from "../i18n";

export type { CollectionData, CollectionItem } from "./collections-normalize";

let cache: CollectionData[] | null = null;

/** Publicadas, en el orden elegido en insta_bot (order y luego más recientes). */
export async function getCuratedCollections(): Promise<CollectionData[]> {
  if (!cache) {
    const entries = await getCollection("curated");
    cache = entries
      .map((e) => e.data as unknown as CollectionData)
      .sort((a, b) => a.order - b.order || b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  return cache;
}

export const titleOf = (c: CollectionData, locale: Locale) => (locale === "en" ? c.titleEn || c.title : c.title);

/** Intro en el idioma pedido; si falta en inglés, la española. */
export const introOf = (c: CollectionData, locale: Locale) =>
  locale === "en" && c.introEn.length ? c.introEn : c.intro;

/** "es" cuando la página en inglés muestra el texto español por falta de
 *  traducción, para marcarlo con `lang` (lectores de pantalla, buscadores). */
export const titleLangOf = (c: CollectionData, locale: Locale) =>
  locale === "en" && !c.titleEn ? "es" : undefined;
export const introLangOf = (c: CollectionData, locale: Locale) =>
  locale === "en" && !c.introEn.length && c.intro.length ? "es" : undefined;
