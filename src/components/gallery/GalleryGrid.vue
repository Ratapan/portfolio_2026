<script setup lang="ts">
// Grilla de filas justificadas (CSS en global.css: .jrows/.jitem). Cada foto
// es un <a> al WebP original: sin JS abre la imagen; con JS, la isla
// intercepta el clic y abre el visor.
import { cfImage, srcset } from "../../lib/img";
import { captionOf, exifLine, ratioOf, type GPhoto } from "../../lib/gallery-shared";

const props = defineProps<{
  photos: GPhoto[];
  locale: "es" | "en";
  /** Texto alternativo cuando la foto no tiene caption. */
  altFallback: string;
  /** Cuántas fotos del inicio cargan sin lazy (las de la primera vista). */
  eager?: number;
}>();

const emit = defineEmits<{ open: [index: number] }>();

// sizes según la altura base de fila de cada breakpoint (--row-h en
// global.css), ×1,5 por lo que crecen las fotos al completar la fila.
function sizesFor(p: GPhoto): string {
  const r = ratioOf(p);
  const px = (rowH: number) => `min(${Math.round(rowH * r * 1.5)}px, 100vw)`;
  return `(min-width: 1280px) ${px(200)}, (min-width: 768px) ${px(170)}, ${px(140)}`;
}

function alt(p: GPhoto): string {
  return captionOf(p, props.locale) || props.altFallback;
}

function onClick(event: MouseEvent, index: number) {
  // Ctrl/Cmd/Shift-clic o botón del medio: comportamiento normal del enlace.
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  emit("open", index);
}
</script>

<template>
  <div class="jrows">
    <a
      v-for="(p, i) in photos"
      :key="p.id"
      :href="p.url"
      class="jitem group relative block overflow-hidden rounded-md"
      :style="{ '--r': ratioOf(p).toFixed(4), backgroundColor: p.c }"
      :data-index="i"
      @click="onClick($event, i)"
    >
      <img
        :src="cfImage(p.url, 960)"
        :srcset="srcset(p.url, p.w)"
        :sizes="sizesFor(p)"
        :width="p.w"
        :height="p.h"
        :alt="alt(p)"
        :loading="eager && i < eager ? 'eager' : 'lazy'"
        decoding="async"
        class="block size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <span
        v-if="exifLine(p) || captionOf(p, locale)"
        class="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-3 pt-8 pb-2 text-[11px] leading-snug text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <span v-if="captionOf(p, locale)" class="line-clamp-2 block font-medium">{{ captionOf(p, locale) }}</span>
        <span v-if="exifLine(p)" class="block text-white/75">{{ exifLine(p) }}</span>
      </span>
    </a>
  </div>
</template>
