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

export const collections = {
  photos: defineCollection({ loader: photosLoader, schema: photoSchema }),
  tags: defineCollection({ loader: tagsLoader, schema: tagSchema }),
};
