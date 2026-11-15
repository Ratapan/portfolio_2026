// Acceso a Mongo SOLO en el build (loaders de src/content.config.ts).
//
// Se usa el usuario de solo lectura `portfolio_build` (MONGODB_URI). Cada
// loader abre su propio cliente y lo cierra en `finally`: un MongoClient
// abierto deja el proceso de `astro build` colgado al terminar.
import { MongoClient, type Db } from "mongodb";

function mongoUri(): string {
  // .env en local (import.meta.env); variable de entorno del build en Vercel.
  const uri = import.meta.env.MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Falta MONGODB_URI: cópiala en .env (ver .env.example) o defínela como variable del build.",
    );
  }
  return uri;
}

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = new MongoClient(mongoUri(), { serverSelectionTimeoutMS: 15_000 });
  try {
    await client.connect();
    // La base sale de la URI (/rtp_blog).
    return await fn(client.db());
  } finally {
    await client.close();
  }
}

/** Quita null/undefined de primer nivel: en Mongo hay campos guardados como null. */
export function dropNulls<T extends Record<string, unknown>>(
  doc: T,
  keep: readonly string[] = [],
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === null && !keep.includes(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}
