import { palette, HUES, STEPS, type Hue, type Step } from './palette';
import { rgba, toHex, contrast } from './color';

export { palette, HUES, STEPS, contrast, rgba };
export type { Hue, Step };

const p = palette;
const ink = (l: number) => toHex({ l, c: 0.012, h: 262 });

/* ------------------------------------------------------------------------------------------------
   Semantic colours. Four themes: light, dark, light-hc, dark-hc (increased contrast).
   Glass is "light-following glass": a lit rim on the side facing the light, a shaded rim opposite,
   a soft depth gradient inside and a highlight that follows the pointer.
   ------------------------------------------------------------------------------------------------ */
export type ThemeName = 'light' | 'dark' | 'light-hc' | 'dark-hc';

const light = {
  'bg': p.slate[50],
  'bg-elevated': '#ffffff',
  'bg-grouped': p.slate[100],
  'surface': '#ffffff',
  'label': p.slate[950],
  'label-secondary': p.slate[700],
  'label-tertiary': ink(0.525),   /* still readable small text: ≥ 4.5:1 on bg and surface */
  'label-disabled': p.slate[400],
  'separator': rgba(p.slate[900], 0.12),
  'separator-strong': rgba(p.slate[900], 0.22),
  'fill': rgba(p.slate[500], 0.1),
  'fill-strong': rgba(p.slate[500], 0.17),
  'fill-hover': rgba(p.slate[500], 0.14),
  'accent': p.iris[600],
  'accent-hover': p.iris[700],
  'accent-pressed': p.iris[800],
  'accent-soft': rgba(p.iris[500], 0.13),
  'accent-text': p.iris[600],
  /* text on the soft (tinted) accent fill: one step darker than accent-text, so tinted buttons and chips reach 4.5:1 */
  'accent-on-soft': p.iris[700],
  'on-accent': '#ffffff',
  'success': p.jade[600], 'success-soft': rgba(p.jade[500], 0.14), 'success-text': p.jade[700],
  'warning': p.amber[500], 'warning-soft': rgba(p.amber[400], 0.2), 'warning-text': p.amber[800],
  'danger': p.ruby[600], 'danger-soft': rgba(p.ruby[500], 0.12), 'danger-text': p.ruby[600], 'danger-on-soft': p.ruby[700],
  /* filled danger surfaces with white text (badges, destructive filled buttons) */
  'danger-fill': p.ruby[600],
  'info': p.azure[600], 'info-soft': rgba(p.azure[500], 0.13), 'info-text': p.azure[700],
  'focus-ring': p.iris[500],
  'scrim': rgba(p.slate[950], 0.3),
  'glass-fill': 'rgba(255, 255, 255, 0.6)',
  'glass-fill-strong': 'rgba(255, 255, 255, 0.78)',
  'glass-fill-subtle': 'rgba(255, 255, 255, 0.42)',
  'glass-fill-clear': 'rgba(24, 26, 44, 0.22)',
  'glass-rim-lit': 'rgba(255, 255, 255, 0.95)',
  'glass-rim-shade': rgba(p.slate[900], 0.12),
  'glass-depth': 'rgba(255, 255, 255, 0.45)',
  'glass-highlight': 'rgba(255, 255, 255, 0.7)',
  'glass-ink': p.slate[950],
  'glass-selection': rgba(p.iris[500], 0.14),
  'shadow-color': '18, 20, 44',
  'shadow-strength': '1',
  /* data series, in order: hues spaced around the wheel and alternating light/dark, so neighbours differ in
     both hue and lightness (and still separate for common colour-vision deficiencies); each ≥ 3:1 on surface */
  'chart-1': p.iris[600], 'chart-2': p.teal[600], 'chart-3': p.coral[600], 'chart-4': p.azure[700], 'chart-5': p.orchid[600], 'chart-6': p.jade[700],
  'chart-grid': rgba(p.slate[900], 0.08),
};
type Semantic = typeof light;

const dark: Semantic = {
  'bg': ink(0.165),
  'bg-elevated': ink(0.215),
  'bg-grouped': ink(0.135),
  'surface': ink(0.215),
  'label': p.slate[50],
  'label-secondary': p.slate[300],
  'label-tertiary': p.slate[400],
  'label-disabled': p.slate[600],
  'separator': 'rgba(255, 255, 255, 0.12)',
  'separator-strong': 'rgba(255, 255, 255, 0.22)',
  'fill': rgba(p.slate[400], 0.14),
  'fill-strong': rgba(p.slate[400], 0.24),
  'fill-hover': rgba(p.slate[400], 0.19),
  'accent': p.iris[600],
  'accent-hover': p.iris[500],
  'accent-pressed': p.iris[700],
  'accent-soft': rgba(p.iris[400], 0.2),
  'accent-text': p.iris[300],
  'accent-on-soft': p.iris[200],
  'on-accent': '#ffffff',
  'success': p.jade[500], 'success-soft': rgba(p.jade[400], 0.18), 'success-text': p.jade[300],
  'warning': p.amber[400], 'warning-soft': rgba(p.amber[400], 0.18), 'warning-text': p.amber[300],
  'danger': p.ruby[500], 'danger-soft': rgba(p.ruby[400], 0.18), 'danger-text': p.ruby[300], 'danger-on-soft': p.ruby[200],
  'danger-fill': p.ruby[600],
  'info': p.azure[500], 'info-soft': rgba(p.azure[400], 0.18), 'info-text': p.azure[300],
  'focus-ring': p.iris[400],
  'scrim': 'rgba(0, 0, 0, 0.5)',
  'glass-fill': 'rgba(34, 36, 50, 0.52)',
  'glass-fill-strong': 'rgba(30, 32, 44, 0.74)',
  'glass-fill-subtle': 'rgba(40, 42, 58, 0.36)',
  'glass-fill-clear': 'rgba(24, 26, 44, 0.26)',
  'glass-rim-lit': 'rgba(255, 255, 255, 0.24)',
  'glass-rim-shade': 'rgba(0, 0, 0, 0.36)',
  'glass-depth': 'rgba(255, 255, 255, 0.07)',
  'glass-highlight': 'rgba(255, 255, 255, 0.13)',
  'glass-ink': p.slate[50],
  'glass-selection': rgba(p.iris[400], 0.24),
  'shadow-color': '0, 0, 0',
  'shadow-strength': '2.2',
  'chart-1': p.iris[400], 'chart-2': p.teal[400], 'chart-3': p.coral[400], 'chart-4': p.azure[300], 'chart-5': p.orchid[400], 'chart-6': p.jade[300],
  'chart-grid': 'rgba(255, 255, 255, 0.08)',
};

const lightHc: Semantic = {
  ...light,
  'label': '#000000',
  'label-secondary': p.slate[800],
  'label-tertiary': p.slate[800],
  'label-disabled': p.slate[500],
  'separator': p.slate[600],
  'separator-strong': p.slate[800],
  'fill': rgba(p.slate[700], 0.14),
  'fill-strong': rgba(p.slate[700], 0.24),
  'accent': p.iris[800], 'accent-hover': p.iris[900], 'accent-pressed': p.iris[950], 'accent-text': p.iris[800], 'accent-on-soft': p.iris[900],
  'danger-fill': p.ruby[800], 'danger-on-soft': p.ruby[900],
  'danger-text': p.ruby[800], 'success-text': p.jade[800], 'info-text': p.azure[800], 'warning-text': p.amber[900],
  'focus-ring': '#000000',
  'glass-fill': '#ffffff', 'glass-fill-strong': '#ffffff', 'glass-fill-subtle': '#ffffff', 'glass-fill-clear': 'rgba(0, 0, 0, 0.72)',
  'glass-rim-lit': '#000000', 'glass-rim-shade': '#000000', 'glass-depth': 'rgba(255, 255, 255, 0)', 'glass-highlight': 'rgba(255, 255, 255, 0)',
  'glass-selection': rgba(p.iris[700], 0.16),
  'chart-1': p.iris[800], 'chart-2': p.teal[800], 'chart-3': p.coral[800], 'chart-4': p.azure[900], 'chart-5': p.orchid[800], 'chart-6': p.jade[900],
  'chart-grid': rgba(p.slate[900], 0.22),
};

const darkHc: Semantic = {
  ...dark,
  'bg': '#000000', 'bg-grouped': '#000000', 'bg-elevated': ink(0.2), 'surface': ink(0.2),
  'label': '#ffffff',
  'label-secondary': p.slate[200],
  'label-tertiary': p.slate[300],
  'label-disabled': p.slate[500],
  'separator': p.slate[400],
  'separator-strong': p.slate[200],
  'accent': p.iris[800], 'accent-hover': p.iris[700], 'accent-pressed': p.iris[900], 'accent-text': p.iris[200], 'accent-on-soft': p.iris[100],
  'danger-fill': p.ruby[800], 'danger-on-soft': p.ruby[100],
  'danger-text': p.ruby[200], 'success-text': p.jade[200], 'info-text': p.azure[200], 'warning-text': p.amber[200],
  'focus-ring': '#ffffff',
  'glass-fill': '#000000', 'glass-fill-strong': '#000000', 'glass-fill-subtle': '#000000', 'glass-fill-clear': 'rgba(0, 0, 0, 0.78)',
  'glass-rim-lit': '#ffffff', 'glass-rim-shade': '#ffffff', 'glass-depth': 'rgba(255, 255, 255, 0)', 'glass-highlight': 'rgba(255, 255, 255, 0)',
  'glass-selection': rgba(p.iris[300], 0.3),
  'chart-1': p.iris[300], 'chart-2': p.teal[200], 'chart-3': p.coral[300], 'chart-4': p.azure[200], 'chart-5': p.orchid[300], 'chart-6': p.jade[200],
  'chart-grid': 'rgba(255, 255, 255, 0.24)',
};

export const themes: Record<ThemeName, Semantic> = { light, dark, 'light-hc': lightHc, 'dark-hc': darkHc };
export type SemanticToken = keyof Semantic;

/* ------------------------------------------------------------------------------------------------
   Scales
   ------------------------------------------------------------------------------------------------ */
export const space = { 0: '0px', 0.5: '2px', 1: '4px', 1.5: '6px', 2: '8px', 2.5: '10px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px' } as const;

/* Fixed radii (not capsules everywhere): controls 12, bars/panels 22, sheets 28; "full" only for chips, toggles, badges. */
export const radius = { xs: '6px', sm: '9px', md: '12px', lg: '16px', xl: '22px', '2xl': '28px', full: '9999px' } as const;

export const font = {
  sans: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Noto Sans KR", "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
} as const;

/* size / line-height / weight / tracking. 16 px body (web-native), tighter tracking as size grows. */
export const typography = {
  'display': [40, 48, 700, -0.025],
  'title-1': [30, 38, 700, -0.02],
  'title-2': [24, 32, 650, -0.015],
  'title-3': [20, 28, 650, -0.01],
  'headline': [17, 24, 620, -0.005],
  'body': [16, 24, 450, -0.003],
  'callout': [15, 22, 450, 0],
  'subhead': [14, 20, 500, 0],
  'footnote': [13, 18, 450, 0.002],
  'caption': [12, 16, 500, 0.004],
  'caption-2': [11, 14, 550, 0.01],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type TextStyle = keyof typeof typography;

export const size = {
  'control-sm': '32px', 'control-md': '40px', 'control-lg': '48px', 'touch': '44px',
  'bar': '56px', 'tab-bar': '60px', 'row': '52px', 'bar-inset': '12px',
} as const;

/* Blur budget: at most three backdrop-filtered layers per screen (bars, one panel, one sheet). */
export const material = {
  'blur': '18px', 'blur-strong': '28px', 'blur-subtle': '10px', 'saturate': '1.7',
} as const;

export const z = { base: 0, bar: 20, dropdown: 40, sheet: 60, dialog: 70, toast: 80 } as const;

/* ------------------------------------------------------------------------------------------------
   Motion: named springs. CSS gets them as linear() easings (runs on the compositor, no JS per frame);
   JS gets the parameters for interactive (finger-driven) motion.
   ------------------------------------------------------------------------------------------------ */
export type SpringParams = { response: number; damping: number };
export type SpringName = 'snappy' | 'smooth' | 'bouncy' | 'gentle' | 'pop';

/* Motion personalities. Same five named springs, three characters:
   · calm    — settles without visible overshoot; for dense, work-focused UIs
   · lively  — (default) a clear, single overshoot on everything that moves; feels alive without wobbling
   · playful — rubbery: bigger overshoot, more squash & stretch
   `squash` (0–1): how much a travelling selection flattens while it stretches (segmented, tab bar).
   `gel` (0–1): how much a dragged knob stretches with speed, and `lag` (s): how far it trails the finger. */
export type MotionName = 'calm' | 'lively' | 'playful';
export type Motion = Record<SpringName, SpringParams> & { squash: number; gel: number; lag: number };
export const motions: Record<MotionName, Motion> = {
  calm: {
    snappy: { response: 0.26, damping: 0.86 }, smooth: { response: 0.36, damping: 1 }, bouncy: { response: 0.42, damping: 0.72 },
    gentle: { response: 0.5, damping: 1 }, pop: { response: 0.3, damping: 0.64 }, squash: 0, gel: 0, lag: 0,
  },
  lively: {
    snappy: { response: 0.28, damping: 0.7 }, smooth: { response: 0.4, damping: 0.72 }, bouncy: { response: 0.44, damping: 0.62 },
    gentle: { response: 0.5, damping: 0.85 }, pop: { response: 0.3, damping: 0.58 }, squash: 0.14, gel: 0.14, lag: 0.09,
  },
  playful: {
    snappy: { response: 0.3, damping: 0.6 }, smooth: { response: 0.4, damping: 0.68 }, bouncy: { response: 0.46, damping: 0.56 },
    gentle: { response: 0.52, damping: 0.78 }, pop: { response: 0.32, damping: 0.54 }, squash: 0.22, gel: 0.2, lag: 0.12,
  },
};
export const defaultMotion: MotionName = 'lively';
/* Reduced motion (system setting or theme.reduceMotion): small state changes still move, briefly and without
   overshoot (critically damped, ~110 ms to 90 %); squash, stretch, gel and lag are off. Large movements
   (sheets, blooming menus, sliding toasts) are replaced by fades in the components. */
const calmest = { response: 0.18, damping: 1 };
export const reducedMotion: Motion = { snappy: calmest, smooth: calmest, bouncy: calmest, gentle: calmest, pop: calmest, squash: 0, gel: 0, lag: 0 };
/** The default personality's springs (kept for direct use). */
export const springs: Record<SpringName, SpringParams> = {
  snappy: motions.lively.snappy, smooth: motions.lively.smooth, bouncy: motions.lively.bouncy, gentle: motions.lively.gentle, pop: motions.lively.pop,
};
export const SPRING_NAMES: SpringName[] = ['snappy', 'smooth', 'bouncy', 'gentle', 'pop'];

/** Position of a unit spring released from 0 toward 1 at time t (s). */
export function springAt({ response, damping }: SpringParams, t: number): number {
  const w = (2 * Math.PI) / response;
  if (damping >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
}

/** Settling time: after this the curve stays within 0.1 % of the target. */
export function springDuration(s: SpringParams): number {
  let last = 0;
  for (let t = 0; t < 3; t += 0.001) if (Math.abs(1 - springAt(s, t)) > 0.001) last = t;
  return Math.ceil((last + 0.001) * 1000);
}

/** CSS linear() easing that traces the spring (points every ~12 ms, deduplicated near the tail). */
export function springEasing(s: SpringParams): string {
  const d = springDuration(s) / 1000, n = Math.max(16, Math.round(d / 0.012));
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const v = i === n ? 1 : springAt(s, (d * i) / n);
    pts.push(String(Math.round(v * 10000) / 10000));
  }
  return `linear(${pts.join(', ')})`;
}

export const duration = { instant: 90, fast: 140, base: 200, slow: 320 } as const;
export const easing = {
  out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  inOut: 'cubic-bezier(0.45, 0, 0.2, 1)',
} as const;
