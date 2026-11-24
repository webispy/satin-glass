/* MediaViewer (0.2): full-screen photos. Opens out of its thumbnail and closes back into it; swipe sideways
   between items, pinch / double-tap / ctrl+wheel / +− to zoom, drag to pan, swipe down to dismiss.
   Every finger-driven value runs on springs that keep their velocity (core Spring), on transform and opacity
   only. Reduced motion: opening, closing and paging by button or key fade; finger-driven motion still follows
   the finger and settles without overshoot. */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Spring, animate, fade, loop, prefersReducedMotion, pushLayer, trapFocus, timing, easing } from '@satin-glass/core';
import { cx, useControllable, useIsoLayoutEffect } from './utils';
import { Portal, useTheme } from './foundation';
import { IconButton } from './controls';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons';
import { useOverlayLifecycle, useRelease, type CloseReason } from './overlay-hooks';
import { useMessages } from './messages';

export type MediaItem = {
  /** image URL (or use `render` for anything else: an SVG, a canvas, a video) */
  src?: string;
  alt: string;
  caption?: ReactNode;
  /** natural size; read from the image when it loads if not given (render: defaults to 4:3) */
  width?: number;
  height?: number;
  render?: () => ReactNode;
};

export type MediaViewerProps = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  /** the photos (or rendered items), in the order they are paged through */
  items: MediaItem[];
  /** the item shown, from 0 (controlled; use with `onIndexChange`) */
  index?: number;
  /** the item shown first when uncontrolled, from 0 */
  defaultIndex?: number;
  /** called with the new index when the user pages (a swipe, the arrows, the arrow keys) */
  onIndexChange?: (index: number) => void;
  /** the thumbnail item `index` opens out of and closes back into */
  getOrigin?: (index: number) => HTMLElement | null | undefined;
  /** extra buttons in the top bar */
  actions?: ReactNode;
  /** the dialog's name (default "Media viewer") */
  'aria-label'?: string;
  labels?: { close?: string; previous?: string; next?: string };
  className?: string;
};

const GAP = 24, MAX_ZOOM = 4, DOUBLE_TAP_ZOOM = 2.5;
type Z = { s: number; x: number; y: number };

export function MediaViewer({ open, onClose, items, index, defaultIndex = 0, onIndexChange, getOrigin, actions, 'aria-label': labelProp, labels = {}, className }: MediaViewerProps) {
  const words = useMessages(), label = labelProp ?? words.mediaViewer;
  const n = items.length;
  const [cur, setCur] = useControllable(index, defaultIndex, onIndexChange);
  const at = Math.min(Math.max(0, cur), Math.max(0, n - 1));
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: typeof window !== 'undefined' ? innerWidth : 1024, h: typeof window !== 'undefined' ? innerHeight : 768 });
  /* natural sizes read from loaded images, by source: by index they stayed with the position when `items` changed.
     A Map (an object answered "constructor"), kept in a ref and pruned to the sources in `items`: a load adds one
     entry and bumps `sized`, instead of copying every size the viewer had ever loaded */
  const sizes = useRef(new Map<string, [number, number]>());
  const [sized, setSized] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const release = useRelease();
  const close = useRef(onClose); close.current = onClose;
  const atRef = useRef(at); atRef.current = at;
  const swiped = useRef(false);
  const hiddenThumb = useRef<HTMLElement | null>(null);
  /* photos are looked at in the dark: the viewer is always the dark theme (keeping high contrast) */
  const dark = useTheme().name.endsWith('-hc') ? 'dark-hc' : 'dark';

  /* the item's own size first: another slide of the same source may have a different one */
  const natural = (i: number): [number, number] => {
    const it = items[i];
    if (it?.width && it.height) return [it.width, it.height];
    return (it?.src !== undefined ? sizes.current.get(it.src) : undefined) ?? [4, 3];
  };
  useIsoLayoutEffect(() => {
    const m = sizes.current;
    if (!m.size) return;
    const keep = new Set(items.map((it) => it.src));
    m.forEach((_, k) => { if (!keep.has(k)) m.delete(k); });
  }, [items]);
  const fit = (i: number) => { const [w, h] = natural(i); const k = Math.min(box.w / w, box.h / h); return { fw: w * k, fh: h * k }; };
  const pitch = box.w + GAP;

  /* the live layers of the current slide */
  const layer = (i = atRef.current) => root.current?.querySelector<HTMLElement>(`[data-sg-slide="${i}"] .sg-media__dismiss`) ?? null;
  const frame = (i = atRef.current) => root.current?.querySelector<HTMLElement>(`[data-sg-slide="${i}"] .sg-media__frame`) ?? null;

  /* ---------------------------------------------------------------- springs (velocity carries across retargets) */
  const z = useRef<Z>({ s: 1, x: 0, y: 0 });
  const zs = useRef<{ s: Spring; x: Spring; y: Spring } | null>(null);
  const tx = useRef<Spring | null>(null);
  const stopZ = useRef<() => void>(() => {}), stopT = useRef<() => void>(() => {});
  const paintZ = () => { const f = frame(); if (f) f.style.transform = z.current.s === 1 && !z.current.x && !z.current.y ? '' : `translate(${z.current.x}px, ${z.current.y}px) scale(${z.current.s})`; };
  const paintT = (x: number) => { if (track.current) track.current.style.transform = `translateX(${x}px)`; };
  const bounds = (s: number) => { const { fw, fh } = fit(atRef.current); return { mx: Math.max(0, (fw * s - box.w) / 2), my: Math.max(0, (fh * s - box.h) / 2) }; };
  const clampZ = (t: Z): Z => { const s = Math.min(MAX_ZOOM, Math.max(1, t.s)); const { mx, my } = bounds(s); return { s, x: Math.min(mx, Math.max(-mx, t.x)), y: Math.min(my, Math.max(-my, t.y)) }; };
  const springZ = (target: Z, kind: 'snappy' | 'smooth' = 'snappy') => {
    stopZ.current();
    const el = root.current;
    if (!zs.current) zs.current = { s: new Spring(z.current.s, kind, el), x: new Spring(z.current.x, kind, el), y: new Spring(z.current.y, kind, el) };
    const sp = zs.current;
    (['s', 'x', 'y'] as const).forEach((k) => { sp[k].set(kind, el); sp[k].value = z.current[k]; sp[k].target = target[k]; });
    setZoomed(target.s > 1.01);
    stopZ.current = loop((dt) => {
      sp.s.step(dt); sp.x.step(dt); sp.y.step(dt);
      z.current = { s: sp.s.value, x: sp.x.value, y: sp.y.value };
      if (sp.s.settled && sp.x.settled && sp.y.settled) { z.current = { ...target }; paintZ(); return false; }
      paintZ();
    });
  };
  const resetZ = () => { stopZ.current(); zs.current = null; z.current = { s: 1, x: 0, y: 0 }; root.current?.querySelectorAll<HTMLElement>('.sg-media__frame').forEach((f) => { f.style.transform = ''; }); setZoomed(false); };
  const trackTo = (i: number, velocity = 0) => {
    stopT.current();
    const el = root.current;
    const target = -i * pitch;
    if (!tx.current) tx.current = new Spring(target, 'smooth', el);
    const sp = tx.current;
    sp.set('smooth', el); sp.target = target; sp.velocity += velocity;
    stopT.current = loop((dt) => { sp.step(dt); paintT(sp.value); if (sp.settled) { sp.jump(target); paintT(target); return false; } });
  };
  /* zoom about a point (stage coordinates, origin at the centre) */
  const zoomAt = (cx: number, cy: number, s: number, kind: 'snappy' | 'smooth' = 'snappy') => {
    const k = s / z.current.s;
    springZ(clampZ({ s, x: cx - (cx - z.current.x) * k, y: cy - (cy - z.current.y) * k }), kind);
  };

  /* ---------------------------------------------------------------- paging */
  /* the track follows the committed index, never the one asked for: a controlled parent may keep its `index`
     (the photo then stayed on the next slide while the caption, counter and names said the old one). `go` asks;
     the effect below moves the track once the index is known, with the motion of what asked (a swipe's velocity),
     and an index changed from outside pages the same way. */
  const asked = useRef<{ how: 'key' | 'swipe'; velocity: number } | null>(null);
  const [, ask] = useState(0);
  const go = (i: number, how: 'key' | 'swipe' = 'key', velocity = 0) => {
    if (i < 0 || i >= n || i === atRef.current) { trackTo(atRef.current, velocity); return; }
    asked.current = { how, velocity };
    setCur(i);
    ask((k) => k + 1);   /* a render even when the parent declines, so the track settles back */
  };
  const page = (i: number, how: 'key' | 'swipe', velocity: number, far = false) => {
    resetZ();
    /* only the item and its two neighbours are mounted, so a move of more than one item (Home, End, an index set
       from outside) would slide through empty stage: it fades in place instead, as reduced motion does */
    if (far || (how === 'key' && prefersReducedMotion(root.current))) {
      /* a large movement: fade the new item in place */
      stopT.current(); tx.current?.jump(-i * pitch); paintT(-i * pitch);
      /* unless the index moved on again before the frame: that item is a neighbour now, sliding away */
      requestAnimationFrame(() => { const l = atRef.current === i ? layer(i) : null; if (l) fade(l, 0, 1, timing.appear); });
    } else trackTo(i, velocity);
  };
  /* the thumbnail of the open item stays hidden: the photo has "left" it */
  const hideThumb = (i: number) => {
    if (hiddenThumb.current) hiddenThumb.current.style.visibility = '';
    /* no item, no thumbnail: an app's `i => thumbs.get(items[i].src)` would throw */
    const t = i < items.length ? getOrigin?.(i) ?? null : null;
    if (t) t.style.visibility = 'hidden';
    hiddenThumb.current = t;
  };
  useEffect(() => { if (open) hideThumb(at); }, [at]);

  /* ---------------------------------------------------------------- size */
  useIsoLayoutEffect(() => { stopT.current(); tx.current?.jump(-atRef.current * pitch); paintT(-atRef.current * pitch); if (z.current.s > 1) { z.current = clampZ(z.current); paintZ(); } }, [box.w, box.h]);

  /* ---------------------------------------------------------------- open / close */
  /* the photo as its thumbnail shows it: scaled to cover the thumbnail and cropped to it, corners and all (a crop of a
     different shape, or a whole photo shrunk inside it, snapped to the thumbnail at the last frame). Clips are in the
     layer's own coordinates: it fills the stage with the photo centred. */
  const origin = (i: number, b = box) => {
    const t = getOrigin?.(i);
    if (!t) return null;
    const r = t.getBoundingClientRect();
    if (r.width < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    const { fw, fh } = fit(i);
    const k = Math.max(r.width / fw, r.height / fh), vw = r.width / k, vh = r.height / k;
    const rad = (parseFloat(getComputedStyle(t).borderTopLeftRadius) || 0) / k;
    return {
      transform: `translate(${(r.left + r.width / 2 - b.w / 2).toFixed(2)}px, ${(r.top + r.height / 2 - b.h / 2).toFixed(2)}px) scale(${k.toFixed(5)})`,
      clip: `inset(${((b.h - vh) / 2).toFixed(2)}px ${((b.w - vw) / 2).toFixed(2)}px round ${rad.toFixed(2)}px)`,
      /* the open end: the whole stage (a zoomed photo spills past its frame; nothing lies past the stage) */
      full: 'inset(0px 0px round 0px)',
    };
  };
  const { mounted } = useOverlayLifecycle(open, () => {
    const el = root.current!;
    swiped.current = false; setChrome(true);
    /* lock first, then measure: the lock takes the page's scrollbar away and the stage widens */
    const pop = pushLayer(() => close.current('escape'), true, el);
    /* the release is registered at once: anything below that throws (an app's getOrigin) still gives back the
       page's scroll and focus */
    let trap = () => {};
    release.set(() => { pop(); trap(); stopZ.current(); stopT.current(); });
    const st = stage.current!; const b = { w: st.clientWidth, h: st.clientHeight };
    if (b.w !== box.w || b.h !== box.h) setBox(b);
    z.current = { s: 1, x: 0, y: 0 }; zs.current = null;
    tx.current = new Spring(-atRef.current * (b.w + GAP), 'smooth', el); paintT(-atRef.current * (b.w + GAP));
    trap = trapFocus(el, el.querySelector<HTMLElement>('[data-sg-close]'));
    hideThumb(atRef.current);
    const l = layer();
    backdrop.current!.style.opacity = '';
    /* no item to open out of (`items` empty): the viewer fades in with its bar */
    if (prefersReducedMotion(el) || !l) return fade(el, 0, 1, timing.appear);
    const from = origin(atRef.current, b);
    fade(backdrop.current!, 0, 1, 220);
    el.querySelectorAll<HTMLElement>('.sg-media__bar, .sg-media__caption, .sg-media__nav').forEach((x) => fade(x, 0, 1, 200));
    if (from) return animate(l, [{ transform: from.transform, clipPath: from.clip }, { transform: 'none', clipPath: from.full }], 'smooth').finished.then(() => undefined, () => undefined);
    return animate(l, [{ transform: 'scale(0.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], 'smooth').finished.then(() => undefined, () => undefined);
  }, () => {
    const before = document.activeElement;
    release.run();
    /* where the focus trap gave focus back (the opener: the first thumbnail pressed, not the one you are on now) */
    const returned = document.activeElement;
    const el = root.current!;
    /* the photo folds back into the thumbnail of the item you were on: focus lands there too (once visible) */
    const restore = () => {
      const t = hiddenThumb.current;
      if (t) t.style.visibility = '';
      hiddenThumb.current = null;
      const a = document.activeElement;
      if (t && document.contains(t) && (!a || a === document.body || !el.isConnected || el.contains(a) || a === before || a === returned)) t.focus({ preventScroll: true });
    };
    if (prefersReducedMotion(el)) return fade(el, 1, 0, timing.leave).then(restore);
    const l = layer(), f = frame();
    el.querySelectorAll<HTMLElement>('.sg-media__bar, .sg-media__caption, .sg-media__nav').forEach((x) => fade(x, +getComputedStyle(x).opacity, 0, 120));
    const bd = backdrop.current!;
    fade(bd, +getComputedStyle(bd).opacity, 0, 220);
    if (!l) return fade(el, 1, 0, 160).then(restore);
    const now = getComputedStyle(l).transform;
    const start = now && now !== 'none' ? now : 'none';
    if (f && f.style.transform) f.animate([{ transform: f.style.transform }, { transform: 'none' }], { duration: 220, easing: easing.move, fill: 'both' });
    const st = stage.current, to = origin(atRef.current, st ? { w: st.clientWidth, h: st.clientHeight } : box);
    if (to) return l.animate([{ transform: start, clipPath: to.full }, { transform: to.transform, clipPath: to.clip }], { duration: timing.mediaReturn, easing: easing.move, fill: 'both' }).finished.then(restore, restore);
    return l.animate([{ transform: start, opacity: 1 }, { transform: `${start === 'none' ? '' : start} scale(0.94)`, opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'both' }).finished.then(restore, restore);
  });
  useEffect(() => () => { if (hiddenThumb.current) hiddenThumb.current.style.visibility = ''; }, []);
  /* the track goes to the committed index: on the paging spring (or the reduced-motion fade) when it changed — by
     the viewer's own paging or from outside (the parent's `index`, `items` shrinking under it) — and back to it
     when a page change was declined (from where a swipe let go) */
  const placedAt = useRef(at);
  useIsoLayoutEffect(() => {
    const a = asked.current, moved = placedAt.current !== at;
    asked.current = null; placedAt.current = at;
    if (!mounted || !tx.current) return;
    /* far from where the track is now, not from the last index: two quick steps leave it short of the first */
    if (moved) page(at, a?.how ?? 'key', a?.velocity ?? 0, Math.abs(tx.current.value / pitch + at) > 1);
    else if (a) trackTo(at, a.velocity);
  });
  /* a page button disabled under the focus (its end reached, or the items changed) or taken away (one item left)
     drops the focus to the page, and the arrow keys with it; Chromium does so before this runs, so it is decided
     from the button that had focus, not from where focus is now. It moves to the other page button, else the viewer. */
  const focused = useRef<HTMLElement | null>(null);
  useIsoLayoutEffect(() => {
    const f = focused.current, el = root.current, a = document.activeElement;
    if (!f || !el || !(f.isConnected ? (f as HTMLButtonElement).disabled : true) || !(a === f || !a || a === document.body)) return;
    const to = el.querySelector<HTMLElement>('.sg-media__nav:not(:disabled)') ?? el;
    focused.current = to; to.focus({ preventScroll: true });
  });
  /* the stage's own size, not the window's: the scroll lock takes the page's scrollbar away (and closing gives it
     back) without a resize event, and a box 15 px off put the photo that far from its thumbnail */
  useEffect(() => {
    const st = stage.current;
    if (!open || !st) return;
    const on = () => setBox((b) => (b.w === st.clientWidth && b.h === st.clientHeight ? b : { w: st.clientWidth, h: st.clientHeight }));
    on();
    if (typeof ResizeObserver === 'undefined') { addEventListener('resize', on); return () => removeEventListener('resize', on); }
    const ro = new ResizeObserver(on); ro.observe(st);
    return () => ro.disconnect();
  }, [open, mounted]);

  /* ---------------------------------------------------------------- gestures */
  useEffect(() => {
    const st = stage.current;
    if (!mounted || !st) return;
    const pts = new Map<number, { x: number; y: number }>();
    type Mode = 'none' | 'pending' | 'pan' | 'page' | 'dismiss' | 'pinch';
    let mode: Mode = 'none', sx = 0, sy = 0, lx = 0, ly = 0, lt = 0, vx = 0, vy = 0, t0 = 0;
    let base: Z = z.current, baseT = 0, d0 = 1, c0 = { x: 0, y: 0 }, dy = 0, lastTap = { t: 0, x: 0, y: 0 }, tapTimer = 0, freed = false;
    const rel = (x: number, y: number) => { const r = st.getBoundingClientRect(); return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 }; };
    const pinchInfo = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), c: rel((a.x + b.x) / 2, (a.y + b.y) / 2) }; };
    const rubber = (v: number, lim: number) => (Math.abs(v) <= lim ? v : Math.sign(v) * (lim + Math.sqrt(Math.abs(v) - lim) * 4));
    const setDismiss = (y: number, x = 0) => {
      const l = layer(); if (!l) return;
      /* finished entrance / settle animations hold their end state (fill): let go of them, the finger rules now.
         Once per gesture: getAnimations() flushes styles, and per move it cost a style recalculation a frame */
      if (!freed) { freed = true; l.getAnimations().forEach((a) => a.cancel()); backdrop.current?.getAnimations().forEach((a) => a.cancel()); }
      const k = 1 - Math.min(0.3, Math.abs(y) / (box.h * 1.6));
      l.style.transform = y || x ? `translate(${x}px, ${y}px) scale(${k})` : '';
      if (backdrop.current) backdrop.current.style.opacity = String(Math.max(0, 1 - Math.abs(y) / (box.h * 0.55)));
    };
    const startOne = (p: { x: number; y: number }, e: PointerEvent) => {
      sx = lx = p.x; sy = ly = p.y; lt = e.timeStamp; vx = vy = 0; t0 = e.timeStamp; freed = false;
      stopZ.current(); base = { ...z.current };
      mode = z.current.s > 1.01 ? 'pan' : 'pending';
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button, a, input')) return;
      try { st.setPointerCapture(e.pointerId); } catch { /* */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        if (mode === 'page') trackTo(atRef.current);
        if (mode === 'dismiss') { dy = 0; setDismiss(0); }
        mode = 'pinch'; stopZ.current(); base = { ...z.current };
        const pi = pinchInfo(); d0 = Math.max(1, pi.d); c0 = pi.c;
      } else if (pts.size === 1) startOne({ x: e.clientX, y: e.clientY }, e);
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dt = Math.max(1, e.timeStamp - lt);
      vx = 0.6 * vx + 0.4 * ((e.clientX - lx) / dt) * 1000; vy = 0.6 * vy + 0.4 * ((e.clientY - ly) / dt) * 1000;
      lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
      const dx = e.clientX - sx, ddy = e.clientY - sy;
      if (mode === 'pinch' && pts.size >= 2) {
        const { d, c } = pinchInfo();
        const s = Math.max(0.6, Math.min(MAX_ZOOM * 1.25, base.s * (d / d0)));
        const qx = (c0.x - base.x) / base.s, qy = (c0.y - base.y) / base.s;   /* image point under the fingers */
        z.current = { s, x: c.x - qx * s, y: c.y - qy * s }; paintZ();
        return;
      }
      if (mode === 'pending') {
        if (Math.hypot(dx, ddy) < 8) return;
        mode = Math.abs(dx) > Math.abs(ddy) && n > 1 ? 'page' : 'dismiss';
        stopT.current(); baseT = tx.current?.value ?? -atRef.current * pitch;
        /* the bars step aside only for a dismiss (the photo leaves): paging keeps them, as the buttons do — hiding
           them per flick made them bob on every quick swipe */
        if (mode === 'dismiss') setChrome(false);
      }
      if (mode === 'pan') {
        const { mx, my } = bounds(base.s);
        z.current = { s: base.s, x: rubber(base.x + dx, mx), y: rubber(base.y + ddy, my) }; paintZ();
      } else if (mode === 'page') {
        const edge = (atRef.current === 0 && dx > 0) || (atRef.current === n - 1 && dx < 0);
        const x = baseT + (edge ? dx * 0.35 : dx);
        if (tx.current) { tx.current.value = x; tx.current.velocity = 0; }
        paintT(x);
      } else if (mode === 'dismiss') { dy = ddy; setDismiss(ddy, dx * 0.4); }
    };
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      const cancelled = e.type === 'pointercancel';
      if (mode === 'pinch') {
        if (pts.size === 1) { const [p] = [...pts.values()]; startOne(p, e); mode = 'pan'; base = { ...z.current }; return; }
        if (pts.size === 0) { mode = 'none'; springZ(clampZ(z.current)); }
        return;
      }
      if (pts.size) return;
      const m = mode; mode = 'none';
      /* a release after a pause carries no fling */
      if (e.timeStamp - lt > 80) { vx = 0; vy = 0; }
      if (m === 'pan') { springZ(clampZ({ s: z.current.s, x: z.current.x + vx * 0.08, y: z.current.y + vy * 0.08 }), 'smooth'); return; }
      if (m === 'page') {
        const dx = e.clientX - sx;
        const i = atRef.current;
        const next = cancelled ? i : dx < -box.w * 0.22 || vx < -500 ? i + 1 : dx > box.w * 0.22 || vx > 500 ? i - 1 : i;
        go(Math.min(n - 1, Math.max(0, next)), 'swipe', vx);
        return;
      }
      if (m === 'dismiss') {
        if (!cancelled && (Math.abs(dy) > 110 || Math.abs(vy) > 700)) { swiped.current = true; close.current('swipe'); return; }
        const l = layer(), from = dy;
        dy = 0;
        if (l) { const tr = l.style.transform; l.style.transform = ''; if (tr) animate(l, [{ transform: tr }, { transform: 'none' }], 'smooth'); }
        if (backdrop.current) { const o = +backdrop.current.style.opacity || 1; backdrop.current.style.opacity = ''; if (from) fade(backdrop.current, o, 1, 160); }
        setChrome(true);
        return;
      }
      if (m === 'pending' && !cancelled && e.timeStamp - t0 < 350) {
        /* a tap: a double tap zooms at that point; a single tap (touch) shows / hides the bars */
        const c = rel(e.clientX, e.clientY);
        if (e.timeStamp - lastTap.t < 300 && Math.hypot(c.x - lastTap.x, c.y - lastTap.y) < 30) {
          clearTimeout(tapTimer); lastTap = { t: 0, x: 0, y: 0 };
          if (z.current.s > 1.01) springZ({ s: 1, x: 0, y: 0 }); else zoomAt(c.x, c.y, DOUBLE_TAP_ZOOM);
          return;
        }
        lastTap = { t: e.timeStamp, ...c };
        if (e.pointerType !== 'mouse') { clearTimeout(tapTimer); tapTimer = window.setTimeout(() => setChrome((v) => !v), 300); }
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = rel(e.clientX, e.clientY);
      if (e.ctrlKey) {   /* trackpad pinch, or ctrl + wheel */
        stopZ.current();
        const s = Math.max(1, Math.min(MAX_ZOOM, z.current.s * Math.exp(-e.deltaY * 0.01)));
        const k = s / z.current.s;
        z.current = clampZ({ s, x: c.x - (c.x - z.current.x) * k, y: c.y - (c.y - z.current.y) * k }); paintZ();
        setZoomed(s > 1.01);
      } else if (z.current.s > 1.01) { stopZ.current(); z.current = clampZ({ ...z.current, x: z.current.x - e.deltaX, y: z.current.y - e.deltaY }); paintZ(); }
    };
    st.addEventListener('pointerdown', down);
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    st.addEventListener('wheel', wheel, { passive: false });
    return () => {
      clearTimeout(tapTimer);
      st.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      st.removeEventListener('wheel', wheel);
    };
  }, [mounted, box.w, box.h, n, sized]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    const zoom = z.current.s > 1.01;
    const k = e.key;
    if ((k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') && zoom) {
      e.preventDefault();
      const d = 80, dx = k === 'ArrowLeft' ? d : k === 'ArrowRight' ? -d : 0, dy = k === 'ArrowUp' ? d : k === 'ArrowDown' ? -d : 0;
      springZ(clampZ({ ...z.current, x: z.current.x + dx, y: z.current.y + dy }));
    } else if (k === 'ArrowLeft') { e.preventDefault(); go(atRef.current - 1); }
    else if (k === 'ArrowRight') { e.preventDefault(); go(atRef.current + 1); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(n - 1); }
    else if (k === '+' || k === '=') { e.preventDefault(); zoomAt(0, 0, Math.min(MAX_ZOOM, z.current.s * 1.6)); }
    else if (k === '-' || k === '_') { e.preventDefault(); zoomAt(0, 0, Math.max(1, z.current.s / 1.6)); }
    else if (k === '0') { e.preventDefault(); springZ({ s: 1, x: 0, y: 0 }); }
    else return;
    setChrome(true);
  };

  if (!mounted) return null;
  const item = items[at];
  const slides = [at - 1, at, at + 1].filter((i) => i >= 0 && i < n);
  return (
    <Portal>
      {/* tabIndex -1: a click on the photo keeps focus in the viewer, so the keys keep working */}
      <div ref={root} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={cx('sg-media', className)} data-sg-theme={dark}
        data-chrome={chrome ? 'shown' : 'hidden'} data-zoomed={zoomed || undefined} onKeyDown={onKey}
        onFocus={(e) => { focused.current = e.target as HTMLElement; setChrome(true); }}>
        <div ref={backdrop} className="sg-media__backdrop" />
        <div ref={stage} className="sg-media__stage" onDoubleClick={(e) => {
          if (e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType !== 'mouse') return;
          const r = stage.current!.getBoundingClientRect();
          const c = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
          if (z.current.s > 1.01) springZ({ s: 1, x: 0, y: 0 }); else zoomAt(c.x, c.y, DOUBLE_TAP_ZOOM);
        }}>
          <div ref={track} className="sg-media__track">
            {slides.map((i) => {
              const it = items[i], { fw, fh } = fit(i);
              return (
                <div key={i} data-sg-slide={i} className="sg-media__slide" style={{ transform: `translateX(${i * pitch}px)` }} aria-hidden={i !== at || undefined}>
                  <div className="sg-media__dismiss">
                    <div className="sg-media__frame" style={{ width: fw, height: fh }}>
                      {it.render ? it.render() : (
                        <img src={it.src} alt={it.alt} draggable={false}
                          onLoad={(e) => { const im = e.currentTarget, k = it.src; if (!(it.width && it.height) && im.naturalWidth && k !== undefined && !sizes.current.has(k)) { sizes.current.set(k, [im.naturalWidth, im.naturalHeight]); setSized((v) => v + 1); } }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sg-media__bar">
          <IconButton data-sg-close variant="glass" icon={<CloseIcon />} label={labels.close ?? words.close} onClick={() => close.current('action')} />
          {n > 1 && <span className="sg-media__count" aria-live="polite" aria-atomic="true">{at + 1} / {n}</span>}
          <div className="sg-media__actions">{actions}</div>
        </div>
        {n > 1 && (
          <>
            <IconButton className="sg-media__nav sg-media__nav--prev" variant="glass" icon={<ChevronLeftIcon />} label={labels.previous ?? words.previous} disabled={at === 0} onClick={() => go(at - 1)} />
            <IconButton className="sg-media__nav sg-media__nav--next" variant="glass" icon={<ChevronRightIcon />} label={labels.next ?? words.next} disabled={at === n - 1} onClick={() => go(at + 1)} />
          </>
        )}
        {item?.caption && <div className="sg-media__caption">{item.caption}</div>}
        {item?.render && <span className="sg-visually-hidden">{item.alt}</span>}
      </div>
    </Portal>
  );
}
