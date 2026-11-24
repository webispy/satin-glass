import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type Ref, type RefCallback } from 'react';

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

/** An id for wiring labels and descriptions (aria-labelledby, aria-controls, a gradient's url(#…)), the same on the
    server and in the browser that hydrates it: React's useId, from the component's place in the tree, not a count of
    renders. React writes it as ":R1:" (18), "«R1»" (19.0–19.1) or "_R_1_", after an app's identifierPrefix. Letters,
    digits and '-' are kept; '_' and every other character are written as "_<hex code>_", so it can stand in a CSS
    selector or a url(#…) without escaping, and two different ids (two roots with prefixes "a:b-" and "ab-") never
    become the same one. */
const idSafe = (s: string) => s.replace(/[^A-Za-z0-9-]/gu, (c) => `_${c.codePointAt(0)!.toString(16)}_`);
export function useStableId(prefix = 'sg'): string {
  return `${prefix}-${idSafe(useId())}`;
}

const noSubscribe = () => () => {};
/** false on the server and while the browser hydrates what the server wrote; true in every other render in the
    browser, the first one included. What the server cannot write (a portal into document.body) waits for it: React
    renders again right after the hydration commit, so a part that was open from the start appears then, while a
    browser rendering on its own (the usual case: an overlay opened later) has it at once, in the same commit. */
export function useClient(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/** Keeps a component mounted until its exit animation has finished. Open from the start in server-rendered HTML,
    it mounts once hydrated (see useClient), so its portal exists in the commit its enter animation runs in. */
export function usePresence(open: boolean): { mounted: boolean; closing: boolean; done: () => void } {
  const client = useClient();
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useIsoLayoutEffect(() => {
    if (open) { setMounted(true); setClosing(false); }
    else if (mounted) setClosing(true);
  }, [open]);
  const done = useCallback(() => { setMounted(false); setClosing(false); }, []);
  return { mounted: mounted && client, closing, done };
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
