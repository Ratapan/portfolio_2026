// Artículos y proyectos publicados (colecciones `articles` y `projects`).
import { getCollection } from "astro:content";
import type { PostData } from "./posts-normalize";

export type { PostBlock, PostData } from "./posts-normalize";

async function load(name: "articles" | "projects"): Promise<PostData[]> {
  const entries = await getCollection(name);
  return entries
    .map((e) => e.data as unknown as PostData)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

let articles: PostData[] | null = null;
let projects: PostData[] | null = null;

/** Artículos publicados, más recientes primero. */
export async function getArticles(): Promise<PostData[]> {
  return (articles ??= await load("articles"));
}

/** Proyectos publicados, más recientes primero. */
export async function getProjects(): Promise<PostData[]> {
  return (projects ??= await load("projects"));
}

export function formatDate(date: Date, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-CL" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
