// Datos estructurados (JSON-LD) para buscadores: Person en la home y en
// Sobre mí, BlogPosting en los artículos e ImageGallery en las colecciones.
import { ROUTES, t, type Locale } from "../i18n";
import type { PostData } from "./posts";
import type { CollectionData } from "./collections";
import { introOf, titleOf } from "./collections";
import { cfImage } from "./img";

export const SITE = "https://javiersabando.lat";
const PERSON_ID = `${SITE}/#person`;

/** Redes (también las usa Sobre mí). */
export const SOCIALS = [
  { name: "LinkedIn", href: "https://www.linkedin.com/in/javier-sabando/", icon: "linkedin.svg" },
  { name: "GitHub", href: "https://github.com/Ratapan", icon: "github.svg" },
  { name: "Instagram", href: "https://www.instagram.com/ratapics", icon: "ig.svg" },
  { name: "YouTube", href: "https://www.youtube.com/@rtpdev", icon: "youtube.svg" },
];

const personRef = { "@type": "Person", "@id": PERSON_ID, name: "Javier Sabando" };

export function personJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Javier Sabando",
    alternateName: "Rapics",
    url: `${SITE}${ROUTES.home[locale]}`,
    jobTitle: [t(locale, "home.hero.rolePhoto"), t(locale, "home.hero.roleDev")],
    address: { "@type": "PostalAddress", addressLocality: "Santiago", addressCountry: "CL" },
    sameAs: SOCIALS.map((s) => s.href),
  };
}

export function articleJsonLd(post: PostData, kind: "articles" | "projects") {
  const url = `${SITE}${ROUTES[kind].es}${post.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": kind === "articles" ? "BlogPosting" : "CreativeWork",
    headline: post.title,
    description: post.description || post.excerpt || undefined,
    url,
    mainEntityOfPage: url,
    image: cfImage(post.cover.url, 1600),
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    inLanguage: "es",
    author: personRef,
  };
}

export function collectionJsonLd(c: CollectionData, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: titleOf(c, locale),
    description: introOf(c, locale)[0],
    url: `${SITE}${ROUTES.collections[locale]}${c.slug}/`,
    inLanguage: locale,
    dateModified: c.updatedAt.toISOString(),
    author: personRef,
    image: c.photos.slice(0, 12).map((p) => cfImage(p.url, 1600)),
  };
}
