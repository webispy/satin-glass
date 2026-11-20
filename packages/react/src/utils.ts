import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref, type RefCallback } from 'react';

export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Meaning colours shared by tags, banners, meters, sparklines: one vocabulary across components. */
export type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Controlled when `value` is given, uncontrolled otherwise. */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? (value as T) : inner;
  const cb = useRef(onChange);
  cb.current = onChange;
  const set = useCallback((v: T) => {
    if (!controlled) setInner(v);
    cb.current?.(v);
  }, [controlled]);
  return [current, set];
}

export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node: T) => {
    for (const r of refs) {
      if (typeof r === 'function') r(node);
      else if (r) (r as { current: T | null }).current = node;
    }
  };
}

let counter = 0;
export function useStableId(prefix = 'sg'): string {
  const [id] = useState(() => `${prefix}-${++counter}`);
  return id;
}

/** Keeps a component mounted until its exit animation has finished. */
export function usePresence(open: boolean): { mounted: boolean; closing: boolean; done: () => void } {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useIsoLayoutEffect(() => {
    if (open) { setMounted(true); setClosing(false); }
    else if (mounted) setClosing(true);
  }, [open]);
  const done = useCallback(() => { setMounted(false); setClosing(false); }, []);
  return { mounted, closing, done };
}

/** Average colour of an image (for tinted glass over media). Computed once on a 16 × 16 canvas. */
export function useImageTint(src: string | undefined): string | undefined {
  const [tint, setTint] = useState<string>();
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data;
        let r = 0, gg = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4;
        if (alive) setTint(`rgb(${Math.round(r / n)}, ${Math.round(gg / n)}, ${Math.round(b / n)})`);
      } catch { /* cross-origin image without CORS: no tint */ }
    };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return tint;
}

/** The one item of a roving group that takes Tab: the chosen one, or the first enabled one when the chosen one is
    disabled (a disabled button cannot take focus, which would leave the whole group out of the tab order). */
export function tabStop(index: number, count: number, disabled: (i: number) => boolean): number {
  if (index >= 0 && index < count && !disabled(index)) return index;
  for (let i = 0; i < count; i++) if (!disabled(i)) return i;
  return -1;
}
