<script setup lang="ts">
// Visor de fotos (port de ImageLightbox.vue de portfolio_2025, sin Pinia):
// teclado (Esc, ←, →), swipe (horizontal = navegar, hacia abajo = cerrar),
// contador, puntos en móvil y panel de información con EXIF y textos.
// Se carga recién con el primer clic (import dinámico desde GalleryExplorer).
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { cfImage, srcset } from "../../lib/img";
import { captionOf, footerOf, type GPhoto } from "../../lib/gallery-shared";

const props = defineProps<{
  photos: GPhoto[];
  index: number;
  locale: "es" | "en";
  ui: Record<string, string>;
}>();

const emit = defineEmits<{ close: []; "update:index": [index: number] }>();

const showInfo = ref(false);
const closeButton = ref<HTMLButtonElement | null>(null);
const current = computed(() => props.photos[props.index]);
const many = computed(() => props.photos.length > 1);
const showDots = computed(() => props.photos.length > 1 && props.photos.length <= 9);

const caption = computed(() => (current.value ? captionOf(current.value, props.locale) : ""));
const footer = computed(() => (current.value ? footerOf(current.value, props.locale) : ""));
const text = computed(() => [caption.value, footer.value].filter(Boolean).join(" "));
const hasMeta = computed(() => {
  const p = current.value;
  return !!p && !!(p.focal || p.ap || p.iso || p.ss || p.cam || p.lens);
});
const hasInfo = computed(() => hasMeta.value || !!text.value);

function go(delta: number) {
  const n = props.photos.length;
  if (n < 2) return;
  emit("update:index", (props.index + delta + n) % n);
}

watch(
  () => props.index,
  () => {
    showInfo.value = false;
    preloadNeighbors();
  },
);

// Precarga la anterior y la siguiente para que el cambio sea instantáneo.
function preloadNeighbors() {
  const n = props.photos.length;
  for (const d of [1, -1]) {
    const p = props.photos[(props.index + d + n) % n];
    if (p && n > 1) {
      const img = new Image();
      img.sizes = "100vw";
      img.srcset = srcset(p.url, p.w) ?? "";
      img.src = cfImage(p.url, 1600);
    }
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === "ArrowRight") go(1);
}

let startX = 0;
let startY = 0;
function onTouchStart(e: TouchEvent) {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - startX;
  const dy = e.changedTouches[0].clientY - startY;
  if (Math.abs(dy) > Math.abs(dx) && dy > 80) emit("close");
  else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
}

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  document.documentElement.style.overflow = "hidden";
  preloadNeighbors();
  await nextTick();
  closeButton.value?.focus();
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  document.documentElement.style.overflow = "";
});
</script>

<template>
  <div
    class="fixed inset-0 z-[100] flex flex-col bg-black text-white"
    role="dialog"
    aria-modal="true"
    :aria-label="ui.dialog"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div class="flex shrink-0 items-center justify-between px-4 py-3">
      <span class="text-sm font-medium text-white/50 tabular-nums" aria-live="polite">
        {{ index + 1 }}<span class="mx-1 text-white/25">/</span>{{ photos.length }}
      </span>
      <button
        ref="closeButton"
        type="button"
        class="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        :aria-label="ui.close"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" class="size-6" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="relative flex min-h-0 flex-1 items-center justify-center px-2 md:px-16" @click.self="emit('close')">
      <button
        v-if="many"
        type="button"
        class="absolute top-1/2 left-3 z-10 hidden -translate-y-1/2 rounded-full p-2.5 text-white/50 transition hover:bg-white/10 hover:text-white md:flex"
        :aria-label="ui.previous"
        @click="go(-1)"
      >
        <svg viewBox="0 0 24 24" class="size-8" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <img
        v-if="current"
        :key="current.id"
        :src="cfImage(current.url, 1600)"
        :srcset="srcset(current.url, current.w)"
        sizes="100vw"
        :width="current.w"
        :height="current.h"
        :alt="caption"
        class="h-auto max-h-full w-auto max-w-full select-none"
        :style="{ backgroundColor: current.c }"
        draggable="false"
      />

      <button
        v-if="many"
        type="button"
        class="absolute top-1/2 right-3 z-10 hidden -translate-y-1/2 rounded-full p-2.5 text-white/50 transition hover:bg-white/10 hover:text-white md:flex"
        :aria-label="ui.next"
        @click="go(1)"
      >
        <svg viewBox="0 0 24 24" class="size-8" aria-hidden="true">
          <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <div class="shrink-0">
      <div class="flex items-center justify-between px-6 pt-3 pb-1 md:hidden">
        <button type="button" class="p-2 text-white/60 disabled:opacity-20" :disabled="!many" :aria-label="ui.previous" @click="go(-1)">
          <svg viewBox="0 0 24 24" class="size-7" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div v-if="showDots" class="flex items-center gap-1.5" aria-hidden="true">
          <span
            v-for="(_, i) in photos"
            :key="i"
            class="h-1.5 rounded-full transition-all duration-200"
            :class="i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/30'"
          />
        </div>
        <button type="button" class="p-2 text-white/60 disabled:opacity-20" :disabled="!many" :aria-label="ui.next" @click="go(1)">
          <svg viewBox="0 0 24 24" class="size-7" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <div class="flex justify-center py-2">
        <button
          v-if="hasInfo"
          type="button"
          class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition"
          :class="showInfo ? 'border-white/25 bg-white/10 text-white' : 'border-transparent text-white/50 hover:border-white/15 hover:text-white/80'"
          :aria-expanded="showInfo"
          :aria-label="ui.info"
          @click="showInfo = !showInfo"
        >
          <svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          {{ ui.infoLabel }}
        </button>
        <div v-else class="h-8" />
      </div>

      <div v-if="showInfo && hasInfo && current" class="max-h-[35vh] overflow-y-auto px-4 pb-6">
        <div class="mx-auto max-w-xl space-y-3 border-t border-white/10 pt-4 text-xs">
          <div v-if="hasMeta" class="space-y-2">
            <div v-if="current.cam" class="flex gap-2.5">
              <span class="min-w-16 shrink-0 text-white/40">{{ ui.camera }}</span>
              <span class="text-white/85">{{ current.cam }}</span>
            </div>
            <div v-if="current.lens" class="flex gap-2.5">
              <span class="min-w-16 shrink-0 text-white/40">{{ ui.lens }}</span>
              <span class="text-white/85">{{ current.lens }}</span>
            </div>
            <div class="flex flex-wrap gap-x-5 gap-y-1.5 text-white/75">
              <span v-if="current.focal"><span class="mr-1 text-white/40">{{ ui.focal }}</span>{{ current.focal }}</span>
              <span v-if="current.ap"><span class="mr-1 text-white/40">{{ ui.aperture }}</span>f/{{ current.ap }}</span>
              <span v-if="current.iso"><span class="mr-1 text-white/40">ISO</span>{{ current.iso }}</span>
              <span v-if="current.ss"><span class="mr-1 text-white/40">{{ ui.shutter }}</span>{{ current.ss }}</span>
            </div>
          </div>
          <div v-if="hasMeta && text" class="border-t border-white/10" />
          <p v-if="text" class="leading-relaxed text-white/75">{{ text }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
