// "Mi equipo": estadísticas del EXIF de las fotos publicadas, calculadas en el build.
import { t, type Locale } from "../i18n";
import type { Photo } from "./photos";

export interface GearRow {
  label: string;
  count: number;
  /** Porcentaje entero sobre las fotos con ese dato. */
  share: number;
}

export interface GearStats {
  total: number;
  cameras: GearRow[];
  lenses: GearRow[];
  apertures: GearRow[];
}

// Nombre comercial de los modelos que el EXIF trae en código.
const CAMERA_NAMES: Record<string, string> = {
  "SONY ILCE-7RM3": "Sony α7R III",
  "Panasonic DMC-FZ300": "Panasonic Lumix FZ300",
};

const MISSING = new Set(["", "n/a", "na", "unknown", "-"]);
const MAX_ROWS = 5;

function cameraName(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value || MISSING.has(value.toLowerCase())) return undefined;
  return CAMERA_NAMES[value] ?? value;
}

function rank(labels: (string | undefined)[], otherLabel: string): GearRow[] {
  const counts = new Map<string, number>();
  for (const label of labels) if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  let rows = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (rows.length > MAX_ROWS) {
    const rest = rows.slice(MAX_ROWS - 1).reduce((sum, r) => sum + r.count, 0);
    rows = [...rows.slice(0, MAX_ROWS - 1), { label: otherLabel, count: rest }];
  }
  return rows.map((r) => ({ ...r, share: Math.round((r.count / total) * 100) }));
}

// Rangos de apertura en su orden natural (no por cantidad).
const APERTURE_BUCKETS: { label: string; max: number }[] = [
  { label: "f/1.4 – 2.8", max: 2.8 },
  { label: "f/3.2 – 4.5", max: 4.5 },
  { label: "f/5 – 8", max: 8 },
  { label: "f/9 +", max: Infinity },
];

function apertures(photos: Photo[]): GearRow[] {
  const values = photos.map((p) => p.apertura).filter((v): v is number => !!v);
  if (!values.length) return [];
  return APERTURE_BUCKETS.map((bucket, i) => {
    const min = i === 0 ? 0 : APERTURE_BUCKETS[i - 1].max;
    const count = values.filter((v) => v > min && v <= bucket.max).length;
    return { label: bucket.label, count, share: Math.round((count / values.length) * 100) };
  }).filter((row) => row.count > 0);
}

export function gearStats(photos: Photo[], locale: Locale): GearStats {
  const other = t(locale, "gear.other");
  const builtIn = t(locale, "gear.builtInLens");
  return {
    total: photos.length,
    cameras: rank(photos.map((p) => cameraName(p.camera)), other),
    lenses: rank(
      photos.map((p) => {
        const lens = p.lens?.trim();
        if (lens && !MISSING.has(lens.toLowerCase())) return lens;
        // Cámaras compactas/bridge: el EXIF no nombra el lente.
        const camera = cameraName(p.camera);
        return camera ? `${builtIn} · ${camera}` : undefined;
      }),
      other,
    ),
    apertures: apertures(photos),
  };
}
