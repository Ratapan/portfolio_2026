// Normaliza los docs de `blogs` (artículos y proyectos) en el build.
//
// Port de normalizeBlock de insta_bot/src/lib/portfolioBlogDb.ts, con lo que
// necesita el sitio público:
//   - Legacy: `imageUrl` → `url` (bloques image y slides), orden por `order`.
//   - El HTML de los bloques de texto se sanitiza con la misma allowlist que
//     insta_bot. Los textos legacy sin etiquetas se envuelven en <p>.
//   - Cada foto se enriquece con su doc de `images` (dimensiones, color, EXIF y
//     textos). El caption/footer del bloque manda sobre el del doc.
//   - `file` se conserva como enlace de descarga.
import sanitizeHtml from "sanitize-html";
import type { GPhoto } from "./gallery-shared";

export type ImageSize = "normal" | "ancho" | "completo";

export type PostBlock =
  | { type: "text"; html: string }
  | { type: "image"; size: ImageSize; photo: GPhoto }
  | { type: "slide"; photos: GPhoto[] }
  | { type: "video"; src: string; caption?: string }
  | { type: "code"; code: string; language?: string }
  | { type: "file"; url: string; name: string; fileType?: string };

export interface PostData {
  type: "blog" | "repo";
  slug: string;
  title: string;
  excerpt: string;
  description?: string;
  cover: GPhoto;
  tags: string[];
  technologies: string[];
  githubUrl?: string;
  demoUrl?: string;
  publishedAt: Date;
  updatedAt: Date;
  readingMinutes: number;
  blocks: PostBlock[];
}

// Misma allowlist que insta_bot (portfolioBlogDb.ts) + p/br, que traen los legacy.
const ALLOWED_TAGS = ["p", "br", "a", "strong", "em", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre"];

export function sanitizeText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasTags = /<\s*[a-z][\s\S]*>/i.test(trimmed);
  const html = hasTags
    ? trimmed
    : trimmed
        .split(/\n{2,}/)
        .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
        .join("");
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    // target/rel los pone transformTags (abajo), no vienen del contenido.
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // Enlaces externos en pestaña nueva y sin referrer.
      a: (tagName, attribs) => ({
        tagName,
        attribs: /^https?:/i.test(attribs.href ?? "")
          ? { ...attribs, target: "_blank", rel: "noopener noreferrer" }
          : attribs,
      }),
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const opt = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Doc público de una foto por URL (o uno mínimo si la foto no está catalogada). */
export type PhotoLookup = (url: string) => GPhoto;

const NOISE = new Set(["", "n/a", "na", "unknown", "-"]);
const clean = (v: unknown) => (typeof v === "string" && !NOISE.has(v.trim().toLowerCase()) ? v.trim() : undefined);
const positive = (v: unknown) => (typeof v === "number" && v > 0 ? v : undefined);

/**
 * Doc crudo de `images` → foto pública. Solo copia campos públicos: nada de
 * `originalKey` ni `stars` (además, la consulta ya los excluye).
 */
export function rawToPhoto(doc: Record<string, unknown>, cameraName: (raw?: string) => string | undefined): GPhoto {
  const url = str(doc.url);
  const photo: GPhoto = {
    id: String(doc._id ?? url),
    url,
    w: positive(doc.width),
    h: positive(doc.height),
    c: typeof doc.color === "string" && /^#[0-9a-f]{6}$/i.test(doc.color) ? doc.color : undefined,
    cap: opt(doc.caption),
    capEn: opt(doc.caption_en),
    foot: opt(doc.footer),
    footEn: opt(doc.footer_en),
    focal: opt(doc.focal),
    ap: positive(doc.apertura),
    iso: positive(doc.iso),
    ss: opt(doc.velocidad),
    cam: cameraName(clean(doc.camera)),
    lens: clean(doc.lens),
    cats: [],
    t: 0,
    best: 0,
  };
  const series = doc.series as { id?: unknown; order?: unknown } | null | undefined;
  if (series && typeof series.id === "string" && typeof series.order === "number") {
    photo.series = { id: series.id, order: series.order };
  }
  return Object.fromEntries(Object.entries(photo).filter(([, v]) => v !== undefined)) as unknown as GPhoto;
}

/** Foto mínima para una URL sin doc en `images` (se pinta con un 3:2 fijo). */
export function barePhoto(url: string): GPhoto {
  return { id: url, url, cats: [], t: 0, best: 0 };
}

function withTexts(photo: GPhoto, raw: Record<string, unknown>): GPhoto {
  const out: GPhoto = { ...photo };
  const set = (key: "cap" | "capEn" | "foot" | "footEn", value: string | undefined) => {
    if (value) out[key] = value;
  };
  set("cap", opt(raw.caption));
  set("capEn", opt(raw.caption_en));
  set("foot", opt(raw.footer));
  set("footEn", opt(raw.footer_en));
  return out;
}

function normalizeBlock(raw: unknown, photoOf: PhotoLookup): PostBlock | null {
  const b = (raw ?? {}) as Record<string, unknown>;
  switch (b.type) {
    case "text": {
      const html = sanitizeText(str(b.value));
      return html ? { type: "text", html } : null;
    }
    case "image": {
      const url = str(b.url ?? b.imageUrl);
      if (!url) return null;
      const size = b.size === "ancho" || b.size === "completo" ? b.size : "normal";
      return { type: "image", size, photo: withTexts(photoOf(url), b) };
    }
    case "slide": {
      const slides = Array.isArray(b.slides) ? b.slides : [];
      const photos = slides
        .map((s) => s as Record<string, unknown>)
        .map((s) => ({ s, url: str(s.url ?? s.imageUrl) }))
        .filter(({ url }) => url)
        .map(({ s, url }) => withTexts(photoOf(url), s));
      return photos.length ? { type: "slide", photos } : null;
    }
    case "video": {
      const src = str(b.videoUrl ?? b.url);
      return src ? { type: "video", src, caption: opt(b.caption) } : null;
    }
    case "code": {
      const code = typeof b.value === "string" ? b.value : "";
      return code.trim() ? { type: "code", code, language: opt(b.language) } : null;
    }
    case "file": {
      const url = str(b.fileUrl ?? b.url);
      if (!url) return null;
      return { type: "file", url, name: opt(b.fileName) ?? url.split("/").pop() ?? url, fileType: opt(b.subType ?? b.fileType) };
    }
    default:
      return null;
  }
}

const WORDS_PER_MINUTE = 200;

function readingMinutes(blocks: PostBlock[]): number {
  const words = blocks
    .filter((b): b is Extract<PostBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

const toDate = (v: unknown): Date | undefined => {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

/** URLs de fotos que referencia un doc (portada + bloques), para enriquecerlas de una vez. */
export function referencedUrls(doc: Record<string, unknown>): string[] {
  const urls = new Set<string>();
  if (typeof doc.mainImage === "string") urls.add(doc.mainImage.trim());
  for (const raw of Array.isArray(doc.content) ? doc.content : []) {
    const b = raw as Record<string, unknown>;
    if (b.type === "image") urls.add(str(b.url ?? b.imageUrl));
    if (b.type === "slide" && Array.isArray(b.slides)) {
      for (const s of b.slides as Record<string, unknown>[]) urls.add(str(s.url ?? s.imageUrl));
    }
  }
  urls.delete("");
  return [...urls];
}

export function normalizePost(doc: Record<string, unknown>, photoOf: PhotoLookup, fallbackDate: Date): PostData {
  const content = Array.isArray(doc.content) ? [...doc.content] : [];
  content.sort(
    (a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0),
  );
  const blocks = content.map((b) => normalizeBlock(b, photoOf)).filter((b): b is PostBlock => b !== null);
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

  return {
    type: doc.type === "repo" ? "repo" : "blog",
    slug: str(doc.slug),
    title: str(doc.title),
    excerpt: str(doc.excerpt),
    description: opt(doc.description),
    cover: photoOf(str(doc.mainImage)),
    tags: strings(doc.tags),
    technologies: strings(doc.technologies),
    githubUrl: opt(doc.githubUrl),
    demoUrl: opt(doc.demoUrl),
    // Hay posts publicados sin publishedAt (legacy): se usa createdAt.
    publishedAt: toDate(doc.publishedAt) ?? toDate(doc.createdAt) ?? fallbackDate,
    updatedAt: toDate(doc.updatedAt) ?? toDate(doc.createdAt) ?? fallbackDate,
    readingMinutes: readingMinutes(blocks),
    blocks,
  };
}
