// Textos que se pasan a componentes del cliente (solo los necesarios, no los
// diccionarios completos).
import { t, type Locale } from "../i18n";

/** Textos del visor (Lightbox.vue). */
export function lightboxUi(locale: Locale): Record<string, string> {
  return {
    dialog: t(locale, "lightbox.dialog"),
    close: t(locale, "lightbox.close"),
    previous: t(locale, "lightbox.previous"),
    next: t(locale, "lightbox.next"),
    info: t(locale, "lightbox.info"),
    infoLabel: t(locale, "portfolio.info"),
    camera: t(locale, "image.metadata.camera"),
    lens: t(locale, "image.metadata.lens"),
    focal: t(locale, "image.metadata.focal"),
    aperture: t(locale, "image.metadata.aperture"),
    shutter: t(locale, "image.metadata.shutter"),
  };
}
