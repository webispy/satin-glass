/* OKLCH → sRGB with gamut mapping (chroma reduction), and WCAG contrast. No dependencies. */

export type Oklch = { l: number; c: number; h: number };

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const toGamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));

function linearOf({ l, c, h }: Oklch) {
  const hr = (h * Math.PI) / 180;
  return oklabToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr));
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** Largest chroma ≤ c that is inside sRGB (binary search), so ramps stay vivid but valid. */
export function fitGamut(col: Oklch): Oklch {
  if (inGamut(linearOf(col))) return col;
  let lo = 0, hi = col.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(linearOf({ ...col, c: mid }))) lo = mid; else hi = mid;
  }
  return { ...col, c: lo };
}

export function toRgb(col: Oklch): [number, number, number] {
  const lin = linearOf(fitGamut(col));
  return lin.map((v) => Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255)) as [number, number, number];
}

export function toHex(col: Oklch): string {
  return '#' + toRgb(col).map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => toLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
