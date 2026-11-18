<script setup lang="ts">
// Galería filtrable (port de PortfolioGallery.vue de portfolio_2025).
//
// Diferencias con 2025: no hay API. El HTML trae las primeras fotos ya
// renderizadas (props `initial`); al hidratar, la isla pide una vez
// /data/photos.json (generado en el build) y filtra, ordena y pagina en el
// navegador. Los filtros viven en la URL (mismas claves que 2025, así los
// links viejos siguen sirviendo). El visor se descarga recién al primer clic.
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import GalleryGrid from "./GalleryGrid.vue";
import {
  applyFilters,
  emptyFilters,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  type CategoryGroup,
  type Facets,
  type Filters,
  type GPhoto,
} from "../../lib/gallery-shared";

const Lightbox = defineAsyncComponent(() => import("./Lightbox.vue"));

const props = defineProps<{
  locale: "es" | "en";
  ui: Record<string, string>;
  /** Nombres visibles de las categorías amplias (es/en). */
  groupNames: Record<string, string>;
  facets: Facets;
  /** Primeras fotos (las del HTML) y total del alcance, para pintar sin JS. */
  initial: GPhoto[];
  total: number;
  /** Página de categoría: solo fotos con alguna de estas categorías. */
  scope?: string[];
  dataUrl: string;
  pageSize?: number;
}>();

const PAGE = props.pageSize ?? 30;

const filters = reactive<Filters>(emptyFilters());
const all = shallowRef<GPhoto[] | null>(null);
const shown = ref(PAGE);
const filtersOpen = ref(false);
const lightboxIndex = ref<number | null>(null);
const root = ref<HTMLElement | null>(null);
const sentinel = ref<HTMLElement | null>(null);

// Hasta que llega photos.json se muestran las del HTML (mismo render que el SSR).
const list = computed(() => (all.value ? applyFilters(all.value, filters, props.scope) : props.initial));
const visible = computed(() => list.value.slice(0, shown.value));
const count = computed(() => (all.value ? list.value.length : props.total));
const active = computed(() => hasActiveFilters(filters));
const canLoadMore = computed(() => (all.value ? shown.value < list.value.length : props.total > props.initial.length));

const fmt = (key: string, vars: Record<string, string | number> = {}) =>
  (props.ui[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));

// --- Categorías: en una página de categoría solo se ofrecen las de su grupo.
const groups = computed<CategoryGroup[]>(() => {
  if (!props.scope) return props.facets.categoryGroups;
  const scope = new Set(props.scope);
  return props.facets.categoryGroups
    .map((g) => ({ ...g, categories: g.categories.filter((c) => scope.has(c.value)) }))
    .filter((g) => g.categories.length > 0);
});

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const groupName = (g: CategoryGroup) => (g.parent ? (props.groupNames[g.parent] ?? capitalize(g.parent)) : fmt("otherCats"));
const groupValues = (g: CategoryGroup) => [g.parent, ...g.categories.map((c) => c.value)].filter(Boolean);
const isGroupSelected = (g: CategoryGroup) => groupValues(g).every((v) => filters.categories.includes(v));

function toggleCategory(value: string) {
  const i = filters.categories.indexOf(value);
  if (i >= 0) filters.categories.splice(i, 1);
  else filters.categories.push(value);
}

function toggleGroup(g: CategoryGroup) {
  const values = groupValues(g);
  if (isGroupSelected(g)) filters.categories = filters.categories.filter((v) => !values.includes(v));
  else for (const v of values) if (!filters.categories.includes(v)) filters.categories.push(v);
}

function clearFilters() {
  Object.assign(filters, emptyFilters());
}

const showIso = computed(() => {
  const r = props.facets.iso;
  return r.min !== null && r.max !== null && r.min < r.max;
});
const showAperture = computed(() => {
  const r = props.facets.apertura;
  return r.min !== null && r.max !== null && r.min < r.max;
});

// --- URL ↔ filtros ---
let urlTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filtersToParams(filters).toString(),
  (query) => {
    shown.value = PAGE;
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const url = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
      history.replaceState(history.state, "", url);
    }, 250);
  },
);

// v-model.number deja "" al borrar un número: se normaliza a "sin filtro".
watch(
  () => [filters.isoMin, filters.isoMax, filters.apMin, filters.apMax],
  () => {
    for (const key of ["isoMin", "isoMax", "apMin", "apMax"] as const) {
      if ((filters[key] as unknown) === "") filters[key] = undefined;
    }
  },
);

async function loadAll() {
  if (all.value) return;
  try {
    const res = await fetch(props.dataUrl);
    if (res.ok) all.value = (await res.json()) as GPhoto[];
  } catch {
    // Sin datos extra: queda la primera página del HTML.
  }
}

function loadMore() {
  if (!all.value) {
    void loadAll();
    return;
  }
  if (shown.value < list.value.length) shown.value += PAGE;
}

// --- Visor ---
async function openLightbox(index: number) {
  lightboxIndex.value = index;
}
async function closeLightbox() {
  const index = lightboxIndex.value;
  lightboxIndex.value = null;
  // Devuelve el foco a la foto que se estaba viendo (si está pintada).
  if (index !== null && index >= shown.value) shown.value = Math.ceil((index + 1) / PAGE) * PAGE;
  await nextTick();
  root.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();
}

const lightboxUi = computed(() => ({
  dialog: props.ui.lbDialog,
  close: props.ui.lbClose,
  previous: props.ui.lbPrevious,
  next: props.ui.lbNext,
  info: props.ui.lbInfo,
  infoLabel: props.ui.info,
  camera: props.ui.metaCamera,
  lens: props.ui.metaLens,
  focal: props.ui.metaFocal,
  aperture: props.ui.metaAperture,
  shutter: props.ui.metaShutter,
}));

let observer: IntersectionObserver | undefined;
onMounted(() => {
  const fromUrl = filtersFromParams(new URLSearchParams(location.search));
  if (hasActiveFilters(fromUrl)) {
    Object.assign(filters, fromUrl);
    filtersOpen.value = true;
  }
  void loadAll();
  observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
    rootMargin: "800px",
  });
  if (sentinel.value) observer.observe(sentinel.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(urlTimer);
});

const field =
  "w-full rounded-lg border border-line bg-back1 px-3 py-2 text-sm focus:border-accent focus:outline-none";
</script>

<template>
  <div ref="root" class="flex flex-col gap-6 lg:flex-row lg:gap-8">
    <div class="lg:hidden">
      <button
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium"
        :aria-expanded="filtersOpen"
        aria-controls="gallery-filters"
        @click="filtersOpen = !filtersOpen"
      >
        {{ ui.filters }}
        <span v-if="active" class="size-2 rounded-full bg-accent" />
        <span class="text-font2" aria-hidden="true">{{ filtersOpen ? "▲" : "▼" }}</span>
      </button>
    </div>

    <aside id="gallery-filters" class="space-y-5 lg:block lg:w-60 lg:shrink-0" :class="filtersOpen ? 'block' : 'hidden'">
      <div class="flex items-center justify-between">
        <h2 class="font-sans text-sm font-semibold tracking-wide text-font2 uppercase">{{ ui.filters }}</h2>
        <button v-if="active" type="button" class="text-xs text-accent hover:underline" @click="clearFilters">
          {{ ui.clear }}
        </button>
      </div>

      <input v-model="filters.search" type="search" :placeholder="ui.search" :aria-label="ui.search" :class="field" />

      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input v-model="filters.portfolio" type="checkbox" class="accent-accent" />
        {{ ui.featured }}
      </label>

      <label class="block">
        <span class="mb-1 block text-xs text-font2">{{ ui.sort }}</span>
        <select v-model="filters.sort" :class="field">
          <option value="recientes">{{ ui.sortRecent }}</option>
          <option value="estrellas">{{ ui.sortStars }}</option>
          <option value="focal">{{ ui.sortFocal }}</option>
        </select>
      </label>

      <div v-if="groups.length">
        <span class="mb-1.5 block text-xs text-font2">{{ ui.categories }}</span>
        <div class="space-y-1">
          <details v-for="g in groups" :key="g.parent || 'otras'" :open="!!scope">
            <summary
              class="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs font-medium select-none hover:bg-surface"
              :class="isGroupSelected(g) ? 'text-accent' : ''"
            >
              <span>{{ groupName(g) }}</span>
              <span class="text-font2">{{ g.categories.length }}</span>
            </summary>
            <div class="flex flex-wrap gap-1.5 pt-1.5 pb-1 pl-2">
              <button
                v-if="g.parent && !scope"
                type="button"
                class="rounded-full border border-dashed px-2.5 py-1 text-xs transition-colors"
                :class="isGroupSelected(g) ? 'border-accent bg-accent text-back1' : 'border-line text-font2 hover:border-accent'"
                :aria-pressed="isGroupSelected(g)"
                @click="toggleGroup(g)"
              >
                {{ fmt("allOf", { group: groupName(g) }) }}
              </button>
              <button
                v-for="c in g.categories"
                :key="c.value"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs transition-colors"
                :class="filters.categories.includes(c.value) ? 'border-accent bg-accent text-back1' : 'border-line text-font2 hover:border-accent'"
                :aria-pressed="filters.categories.includes(c.value)"
                @click="toggleCategory(c.value)"
              >
                {{ c.value }} <span class="tabular-nums">{{ c.count }}</span>
              </button>
            </div>
          </details>
        </div>
      </div>

      <label v-if="facets.cameras.length > 1" class="block">
        <span class="mb-1 block text-xs text-font2">{{ ui.camera }}</span>
        <select v-model="filters.camera" :class="field">
          <option value="">{{ ui.any }}</option>
          <option v-for="c in facets.cameras" :key="c.value" :value="c.value">{{ c.value }} ({{ c.count }})</option>
        </select>
      </label>

      <label v-if="facets.lenses.length > 1" class="block">
        <span class="mb-1 block text-xs text-font2">{{ ui.lens }}</span>
        <select v-model="filters.lens" :class="field">
          <option value="">{{ ui.any }}</option>
          <option v-for="l in facets.lenses" :key="l.value" :value="l.value">{{ l.value }} ({{ l.count }})</option>
        </select>
      </label>

      <label v-if="facets.sessions.length" class="block">
        <span class="mb-1 block text-xs text-font2">{{ ui.session }}</span>
        <select v-model="filters.session" :class="field">
          <option value="">{{ ui.any }}</option>
          <option v-for="s in facets.sessions" :key="s.value" :value="s.value">{{ s.value }} ({{ s.count }})</option>
        </select>
      </label>

      <details v-if="showIso || showAperture" class="text-sm">
        <summary class="cursor-pointer text-xs text-font2 select-none">{{ ui.advanced }}</summary>
        <div class="mt-2 space-y-3">
          <fieldset v-if="showIso">
            <legend class="mb-1 text-xs text-font2">{{ ui.iso }}</legend>
            <div class="flex items-center gap-2">
              <input v-model.number="filters.isoMin" type="number" :placeholder="ui.min" :aria-label="`${ui.iso} ${ui.min}`" :class="field" />
              <span class="text-font2">–</span>
              <input v-model.number="filters.isoMax" type="number" :placeholder="ui.max" :aria-label="`${ui.iso} ${ui.max}`" :class="field" />
            </div>
          </fieldset>
          <fieldset v-if="showAperture">
            <legend class="mb-1 text-xs text-font2">{{ ui.aperture }}</legend>
            <div class="flex items-center gap-2">
              <input v-model.number="filters.apMin" type="number" step="0.1" :placeholder="ui.min" :aria-label="`${ui.aperture} ${ui.min}`" :class="field" />
              <span class="text-font2">–</span>
              <input v-model.number="filters.apMax" type="number" step="0.1" :placeholder="ui.max" :aria-label="`${ui.aperture} ${ui.max}`" :class="field" />
            </div>
          </fieldset>
        </div>
      </details>
    </aside>

    <div class="min-w-0 flex-1">
      <p class="mb-3 text-xs text-font2" aria-live="polite">{{ fmt("results", { n: count }) }}</p>

      <p v-if="visible.length === 0" class="py-20 text-center text-font2">{{ ui.empty }}</p>
      <GalleryGrid
        v-else
        :photos="visible"
        :locale="locale"
        :alt-fallback="ui.altFallback"
        :eager="6"
        @open="openLightbox"
      />

      <div ref="sentinel" class="h-px" />
      <div v-if="canLoadMore" class="mt-8 text-center">
        <button type="button" class="btn" @click="loadMore">{{ ui.loadMore }}</button>
      </div>
    </div>

    <Lightbox
      v-if="lightboxIndex !== null"
      :photos="list"
      :index="lightboxIndex"
      :locale="locale"
      :ui="lightboxUi"
      @update:index="lightboxIndex = $event"
      @close="closeLightbox"
    />
  </div>
</template>
