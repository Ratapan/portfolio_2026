// Colecciones del sitio, leídas de Mongo (rtp_blog) SOLO al compilar.
//
// El contrato de `images` tiene su fuente de verdad en
// insta_bot/src/lib/portfolioSchema.ts: si cambia allí, se actualiza aquí.
// Diferencias a propósito:
//   - Solo entran fotos con visible:true (nada se publica sin revisión).
//   - `originalKey` se excluye en la consulta misma: nunca llega al sitio.
//   - Un doc inválido se omite con un warning; no rompe el build.
import { defineCollection } from "astro:content";
import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import { dropNulls, withDb } from "./lib/mongo";
import { barePhoto, normalizePost, rawToPhoto, referencedUrls } from "./lib/posts-normalize";
import { cameraName } from "./lib/gear";

const trimmed = z.string().trim();

const photoSchema = z.object({
  url: trimmed.min(1),
  file: trimmed.min(1),
  caption: trimmed.optional(),
  caption_en: trimmed.optional(),
  footer: trimmed.optional(),
  footer_en: trimmed.optional(),
  focal: trimmed.optional(),
  focalMm: z.number().positive().optional(),
  apertura: z.number().positive().optional(),
  iso: z.number().int().positive().optional(),
  velocidad: trimmed.optional(),
  camera: trimmed.optional(),
  lens: trimmed.optional(),
  // Solo para ordenar en el build; no se publica el número.
  stars: z.number().int().min(0).max(5).default(0),
  portfolio: z.boolean().default(false),
  category: trimmed.optional(),
  categories: z.array(z.string()).default([]),
  session: z.string().nullable().optional(),
  series: z.object({ id: z.string(), order: z.number().int() }).nullable().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  takenAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PhotoData = z.infer<typeof photoSchema>;

const tagSchema = z.object({
  name: trimmed.min(1),
  parent: trimmed.nullable().default(null),
});

/** Detalle de un error de parseData en una línea (campo + problema). */
function issues(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const detail = message
    .split("\n")
    .slice(1)
    .map((line) => line.replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .join("; ");
  return detail || message.split("\n")[0];
}

const photosLoader: Loader = {
  name: "mongo-photos",
  async load({ store, parseData, logger }) {
    const docs = await withDb((db) =>
      db
        .collection("images")
        .find({ visible: true }, { projection: { originalKey: 0, __v: 0 } })
        .sort({ createdAt: -1 })
        .toArray(),
    );
    store.clear();
    let skipped = 0;
    for (const doc of docs) {
      const id = String(doc._id);
      const { _id, ...rest } = doc;
      // Los docs anteriores a insta_bot no tienen createdAt: el ObjectId
      // guarda su fecha de creación.
      rest.createdAt ??= _id.getTimestamp();
      try {
        const data = await parseData({ id, data: dropNulls(rest, ["session", "series"]) });
        store.set({ id, data });
      } catch (err) {
        skipped++;
        logger.warn(`foto ${rest.url ?? id} omitida: ${issues(err)}`);
      }
    }
    logger.info(`${docs.length - skipped} fotos visibles cargadas${skipped ? `, ${skipped} omitidas` : ""}`);
  },
};

const tagsLoader: Loader = {
  name: "mongo-tags",
  async load({ store, parseData, logger }) {
    const docs = await withDb((db) => db.collection("tags").find({}).toArray());
    store.clear();
    for (const doc of docs) {
      const id = String(doc.name ?? doc._id);
      try {
        const data = await parseData({ id, data: { name: doc.name, parent: doc.parent ?? null } });
        store.set({ id, data });
      } catch (err) {
        logger.warn(`tag ${id} omitido: ${issues(err)}`);
      }
    }
  },
};

/**
 * Artículos (type "blog") y proyectos (type "repo") publicados. Las fotos que
 * citan se enriquecen con su doc de `images` AUNQUE tenga visible:false: estar
 * en un artículo publicado ya es publicarla (visible gobierna la galería).
 * Se valida a mano en normalizePost (los docs legacy traen formas viejas), así
 * que la colección no lleva schema de Zod.
 */
function postsLoader(type: "blog" | "repo"): Loader {
  return {
    name: `mongo-posts-${type}`,
    async load({ store, logger }) {
      const { docs, photos } = await withDb(async (db) => {
        // Los docs viejos sin `type` son blogs (default del modelo Mongoose).
        const typeFilter = type === "blog" ? { $in: ["blog", null] } : "repo";
        const docs = await db
          .collection("blogs")
          .find({ status: "published", type: typeFilter }, { projection: { __v: 0 } })
          .toArray();
        const urls = [...new Set(docs.flatMap((d) => referencedUrls(d)))];
        const photos = urls.length
          ? await db
              .collection("images")
              .find({ url: { $in: urls } }, { projection: { originalKey: 0, stars: 0, __v: 0 } })
              .toArray()
          : [];
        return { docs, photos };
      });

      const byUrl = new Map(photos.map((p) => [String(p.url), rawToPhoto(p, cameraName)]));
      const photoOf = (url: string) => byUrl.get(url) ?? barePhoto(url);
      store.clear();
      for (const doc of docs) {
        const post = normalizePost(doc, photoOf, doc._id.getTimestamp());
        if (!post.slug || !post.title) {
          logger.warn(`post ${String(doc._id)} omitido: sin slug o título`);
          continue;
        }
        store.set({ id: post.slug, data: post as unknown as Record<string, unknown> });
      }
      const missing = [...new Set(docs.flatMap((d) => referencedUrls(d)))].filter((u) => !byUrl.has(u));
      logger.info(
        `${docs.length} ${type === "blog" ? "artículos" : "proyectos"} publicados` +
          (missing.length ? ` · ${missing.length} fotos sin doc en images` : ""),
      );
    },
  };
}

export const collections = {
  photos: defineCollection({ loader: photosLoader, schema: photoSchema }),
  tags: defineCollection({ loader: tagsLoader, schema: tagSchema }),
  articles: defineCollection({ loader: postsLoader("blog") }),
  projects: defineCollection({ loader: postsLoader("repo") }),
};
