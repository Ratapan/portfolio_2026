// RSS de los artículos (en español). Se genera en el build.
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getArticles } from "../lib/posts";
import { t } from "../i18n";

export const GET: APIRoute = async (context) => {
  const articles = await getArticles();
  return rss({
    title: `${t("es", "meta.siteName")} · ${t("es", "article.listTitle")}`,
    description: t("es", "article.metaDescription"),
    site: context.site ?? "https://javiersabando.lat",
    items: articles.map((post) => ({
      title: post.title,
      description: post.excerpt,
      pubDate: post.publishedAt,
      link: `/articulos/${post.slug}/`,
      categories: post.tags,
    })),
    customData: "<language>es-cl</language>",
  });
};
