import { toHex, type Oklch } from './color';

/* Our own palette, built in OKLCH so every hue has the same perceived lightness per step
   (a "500" is equally light in every colour) — the basis for predictable contrast. */

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];

/* Lightness per step, and how much of the hue's peak chroma each step gets (pastels and near-blacks are calmer). */
const L: Record<Step, number> = { 50: 0.975, 100: 0.948, 200: 0.9, 300: 0.83, 400: 0.74, 500: 0.645, 600: 0.565, 700: 0.49, 800: 0.41, 900: 0.33, 950: 0.255 };
const C: Record<Step, number> = { 50: 0.12, 100: 0.24, 200: 0.45, 300: 0.7, 400: 0.92, 500: 1, 600: 1, 700: 0.92, 800: 0.8, 900: 0.66, 950: 0.55 };

export const HUES = {
  /* neutrals carry a faint cool cast, so glass over them reads clean rather than grey */
  slate: { h: 262, c: 0.018 },
  /* brand: "iris" — a violet-leaning blue, deliberately away from system blues */
  iris: { h: 274, c: 0.215 },
  azure: { h: 238, c: 0.16 },
  teal: { h: 190, c: 0.13 },
  jade: { h: 158, c: 0.17 },
  lime: { h: 128, c: 0.19 },
  amber: { h: 72, c: 0.17 },
  coral: { h: 38, c: 0.19 },
  ruby: { h: 18, c: 0.21 },
  rose: { h: 352, c: 0.2 },
  orchid: { h: 318, c: 0.2 },
} as const;
export type Hue = keyof typeof HUES;

/* warm hues drift slightly toward yellow when light and toward red when dark, like natural pigments */
const drift = (hue: Hue, step: Step) => (['amber', 'coral', 'lime'].includes(hue) ? (L[step] - 0.6) * 18 : 0);

export function shade(hue: Hue, step: Step): Oklch {
  const { h, c } = HUES[hue];
  return { l: L[step], c: c * C[step], h: h + drift(hue, step) };
}

export const palette: Record<Hue, Record<Step, string>> = Object.fromEntries(
  (Object.keys(HUES) as Hue[]).map((hue) => [hue, Object.fromEntries(STEPS.map((s) => [s, toHex(shade(hue, s))]))]),
) as Record<Hue, Record<Step, string>>;
