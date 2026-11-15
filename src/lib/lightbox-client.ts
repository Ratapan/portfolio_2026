// Visor para páginas sin isla (artículos y proyectos). Este módulo y Vue se
// descargan recién con el primer clic en una foto (import dinámico desde el
// script de ArticleBody), así esas páginas no cargan JS hasta entonces.
import { createApp, h, ref } from "vue";
import Lightbox from "../components/gallery/Lightbox.vue";
import type { GPhoto } from "./gallery-shared";

export interface LightboxPayload {
  photos: GPhoto[];
  locale: "es" | "en";
  ui: Record<string, string>;
}

let app: ReturnType<typeof createApp> | null = null;
const index = ref<number | null>(null);
let lastTrigger: HTMLElement | null = null;

export function openLightbox(payload: LightboxPayload, start: number, trigger?: HTMLElement) {
  lastTrigger = trigger ?? null;
  index.value = start;
  if (app) return;
  const host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({
    render: () =>
      index.value === null
        ? null
        : h(Lightbox, {
            photos: payload.photos,
            index: index.value,
            locale: payload.locale,
            ui: payload.ui,
            "onUpdate:index": (i: number) => (index.value = i),
            onClose: () => {
              index.value = null;
              lastTrigger?.focus();
            },
          }),
  });
  app.mount(host);
}
