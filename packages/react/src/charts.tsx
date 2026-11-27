/* Charts (0.3): own SVG charts for dashboards — line / area, bar (grouped, stacked), donut, sparkline, scatter (0.6) — and the
   small marks that live inside table cells (BarMeter, IntervalPlot).
   Every chart: series colours from the theme (--sg-chart-1…6, ≥ 3:1 on the card), a legend that hides and shows
   series, a crosshair tooltip that follows the pointer or the arrow keys (the plot is focusable and announces the
   point), and the full data as a hidden table for screen readers. Motion is the library's: entrances draw in on
   the named springs (bars rise on 'bouncy', the donut turns in on 'smooth', lines draw on a non-overshooting
   'gentle'), so they follow the motion personality; new data moves there on a spring per value that keeps its
   velocity when the data changes again mid-way. With reduced motion a chart fades in (140 ms) and data changes
   land at once. */
import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Spring, animate, fade, loop, motionFor, prefersReducedMotion, timing } from '@satin-glass/core';
import { cx, useIsoLayoutEffect, useStableId, type Tone } from './utils';
import { messagesFor, useLocaleOf } from './messages';

/* ------------------------------------------------------------------------------------------------ shared */
export type ChartSeries = { key: string; label: string; color?: string };
export type ChartDatum = Record<string, string | number | null | undefined>;
type Fmt = (v: number) => string;

/* defaults shared by every chart, so a memo keyed on them holds while the option is unset */
const asIs = (v: string) => v;
const NO_GROUPS: ChartSeries[] = [];
const COLOR = (i: number) => `var(--sg-chart-${(i % 6) + 1})`;
/* Intl formatters are costly to build: one per locale and options, shared by every chart */
const formatters = new Map<string, Intl.NumberFormat>();
const nf = (locale: string, opts: Intl.NumberFormatOptions) => {
  const k = `${locale}|${JSON.stringify(opts)}`;
  let f = formatters.get(k);
  if (!f) { f = new Intl.NumberFormat(locale, opts); formatters.set(k, f); }
  return f;
};
const fmts = new Map<string, Fmt>();
/* a value (tooltips, the data table, a donut's centre): compact from 10,000 (scientific from 10¹⁵, which compact
   spells out in full), at most one decimal from 1, two significant digits below 1 (0.25, not 0.3; 0.04, not 0),
   scientific below 0.0001 (3.2E-12, not 0) */
const defaultFmt = (locale: string): Fmt => {
  let fn = fmts.get(locale);
  if (!fn) {
    const f = nf(locale, { maximumFractionDigits: 1 }), c = nf(locale, { notation: 'compact', maximumFractionDigits: 1 });
    const small = nf(locale, { maximumSignificantDigits: 2 }), tiny = nf(locale, { notation: 'scientific', maximumSignificantDigits: 2 });
    const huge = nf(locale, { notation: 'scientific', maximumSignificantDigits: 3 });
    /* -0 reads 0, as the axis does */
    fn = (v) => { if (v === 0) return f.format(0); const a = Math.abs(v); return a >= 1e15 ? huge.format(v) : a >= 10000 ? c.format(v) : a >= 1 ? f.format(v) : a >= 1e-4 ? small.format(v) : tiny.format(v); };
    fmts.set(locale, fn);
  }
  return fn;
};
/** An axis's tick labels, written with the digits its step needs and no more: a step of 0.25 reads 0.25 and 0.75 (one
    decimal read 0.3 and 0.8), one of 2 × 10⁻¹² reads 2E-12 (the value format read 0), 1,250,000 reads 1.25M. As values
    are, a tick from 10,000 is compact and one below is written out (an axis reads 5,000 then 10K, so its labels keep
    their width when its range grows past 10,000 and the plot does not jump sideways); the whole axis is scientific for
    a step below 0.0001 or a tick from 10¹⁵ (compact notation spells those out in hundreds of digits). */
function tickFormat(ticks: number[], locale: string): Fmt {
  if (ticks.length < 2) return defaultFmt(locale);
  const gap = STEP.get(ticks) ?? Math.abs(ticks[1] - ticks[0]);
  const top = ticks.reduce((m, t) => Math.max(m, Math.abs(t)), 0);
  if (!(gap > 0) || !Number.isFinite(gap) || !(top > 0)) return defaultFmt(locale);
  /* the step niceTicks chose; else the nominal one read back from a gap that carries float error (0.0001 from
     0.00009999999999999996). Steps are m × 10^e with m one of 1, 2, 2.5, 5, and 2.5 needs one digit more */
  const step = +gap.toPrecision(3);
  const e = Math.floor(Math.log10(step) + 1e-9), m = +(step / 10 ** e).toPrecision(3);
  const extra = Number.isInteger(m) ? 0 : 1;
  const zero = nf(locale, {}).format(0);
  /* significant digits from a tick's magnitude down to the step's last digit; more if two ticks would still read the
     same (a tick held at the largest number sits off the step) */
  const digits = (v: number, more: number) => Math.min(21, Math.max(1, Math.floor(Math.log10(Math.abs(v)) + 1e-9) - e + 1 + extra + more));
  const plain = nf(locale, { maximumFractionDigits: Math.min(20, Math.max(0, extra - e)) });
  const sci = step < 1e-4 || top >= 1e15;
  for (let more = 0; ; more++) {
    const fn: Fmt = (v) => {
      if (v === 0) return zero;
      if (sci) return nf(locale, { notation: 'scientific', maximumSignificantDigits: digits(v, more) }).format(v);
      return Math.abs(v) >= 10000 ? nf(locale, { notation: 'compact', maximumSignificantDigits: digits(v, more) }).format(v) : plain.format(v);
    };
    const labels = ticks.map(fn);
    if (more >= 21 || new Set(labels).size === labels.length) {
      /* made once: each tick's label is looked up, not formatted again on every frame of a move */
      const known = new Map(ticks.map((t, i) => [t, labels[i]]));
      return (v) => known.get(v) ?? fn(v);
    }
  }
}

/* the step niceTicks chose for the ticks it returned: inferred from two ticks, a float gap can miss it (1e10 to
   1e10 + 0.00035 has gaps below 0.0001) */
const STEP = new WeakMap<number[], number>();

/** "Nice" axis: rounds the domain out to 1 / 2 / 2.5 / 5 × 10ⁿ steps. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max)) return [0, 1];
  if (min > max) [min, max] = [max, min];
  const MAX = Number.MAX_VALUE, fit = (v: number) => Math.max(-MAX, Math.min(MAX, v));
  if (min === max) { const d = Math.abs(min) || 1; min = fit(min - d / 2); max = fit(max + d / 2); }
  /* in halves: the span of ±1e308 is itself past the largest number. No step finer than the values' float
     resolution: 1e16 + 0.5 is 1e16 (nanosecond timestamps), and stepping by it never reached the end. */
  const c = Math.max(1, count), res = Math.max(Math.abs(min), Math.abs(max)) * Number.EPSILON * 8;
  const half = Math.max((max / 2 - min / 2) / c, res, 1e-300);
  const steps = [1, 2, 2.5, 5];
  let e = Math.floor(Math.log10(half) + Math.log10(2)), j = steps.findIndex((f) => (f / 2) * 10 ** e >= half);
  if (j < 0) { j = 0; e++; }
  for (;;) {
    /* in units of 10^e, so no step overflows; at most 1000 ticks: past that the step widens, and the ticks still
       reach both ends */
    const u = 10 ** e, m = steps[j];
    /* each tick from its index, written as a decimal at the step's own precision (k·m × 10^e), so ticks neither
       gather error along the axis nor round away in a tiny domain; held within the finite numbers */
    const at = (k: number) => fit(+`${k * m}e${e}`);
    let k0 = Math.floor(min / u / m), k1 = Math.ceil(max / u / m);
    /* the division can round both ends onto one index (0.31 to 0.31000000000000005): the ticks must still enclose
       the domain, two at least, or the axis spans nothing */
    while (at(k0) > min) k0--;
    while (at(k1) < max) k1++;
    if (k1 === k0) k1++;
    if (k1 - k0 > 1000) { if (++j === steps.length) { j = 0; e++; } continue; }
    const out: number[] = [];
    for (let k = k0; k <= k1; k++) { const v = at(k); if (out[out.length - 1] !== v) out.push(v); }
    STEP.set(out, +`${m}e${e}`);
    return out;
  }
}

/* An axis's tick labels, and the ticks it is leaving with the labels they were drawn with. The outgoing ticks are the
   ones on screen when the axis changed (rebuilt from the old endpoints, they could be ticks never shown: a 0.2 step
   rebuilt as 0.25). Labels are made once per set of ticks, not on every frame of the move. */
function useAxisLabels(ticks: number[], locale: string, own: Fmt | undefined) {
  const key = `${ticks.join(',')}|${locale}`;
  const fmt = useMemo(() => own ?? tickFormat(ticks, locale), [key, own]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* the ticks before these, kept as "previous props in state": set during render (React renders again at once), so a
     render that is dropped leaves nothing behind */
  type Kept = { key: string; ticks: number[]; fmt: Fmt; prev: { ticks: number[]; fmt: Fmt } | null };
  const [kept, setKept] = useState<Kept>({ key, ticks, fmt, prev: null });
  let h = kept;
  if (kept.key !== key) { h = { key, ticks, fmt, prev: { ticks: kept.ticks, fmt: kept.fmt } }; setKept(h); }
  else if (kept.fmt !== fmt) { h = { ...kept, fmt }; setKept(h); }
  const prev = h.prev;
  /* while the axis moves (p < 1): the ticks it is leaving, each with its own label */
  const outgoing = (p: number) => (p < 1 && prev ? prev.ticks : ticks);
  const label = (t: number) => (ticks.includes(t) || !prev ? fmt : prev.fmt)(t);
  return { fmt, outgoing, label };
}

/** the least and greatest of many numbers (NaN ignored): spreading a long series into Math.min / Math.max
    overflows the call stack */
function extent(vals: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

/** The width a chart lays out to. Read from a ResizeObserver — after the browser's own layout, never by forcing
    one (reading clientWidth while a whole dashboard mounts made every chart pay for a synchronous page layout).
    Until it is known (one frame) the chart holds its height with an empty box; the drawing then renders as a
    transition, in slices. The server writes that same empty box, so the browser's first render matches it and
    hydrates; without a ResizeObserver the fallback width is used, from the effect. */
function useWidth<T extends HTMLElement>(fallback = 480) {
  const ref = useRef<T>(null);
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') { setW(fallback); return; }
    const ro = new ResizeObserver(([e]) => { const v = Math.round(e.contentRect.width) || fallback; startTransition(() => setW(v)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Move numbers from the previous render to these on a spring each ('smooth' of the motion personality), keeping
    their velocity if the target changes again mid-way. At once the first time and with reduced motion. `now` is what
    a render draws; `painter` draws every frame of a move in place of a render, as useMorph's does (#85). */
function useTween(target: number[], el: React.RefObject<Element | null>, key: string, painter?: React.RefObject<((now: number[]) => boolean | void) | null>): { now: number[]; sample: () => number[]; moving: boolean } {
  const [, paint] = useState(0);
  const springs = useRef<Spring[] | null>(null), stop = useRef<(() => void) | null>(null);
  useIsoLayoutEffect(() => {
    const b = target, cur = springs.current;
    if (!cur || cur.length !== b.length || prefersReducedMotion(el.current)) {
      stop.current?.(); stop.current = null;
      springs.current = b.map((v) => new Spring(v, 'smooth', el.current));
      paint((n) => n + 1);
      return;
    }
    if (cur.every((sp, i) => sp.target === b[i])) {
      /* set up again with the same target (shown after Activity or Suspense hid it): a move its hiding stopped half-way
         settles there rather than staying frozen (#82) */
      if (!stop.current && cur.some((sp) => sp.value !== sp.target)) { cur.forEach((sp) => sp.jump(sp.target)); paint((n) => n + 1); }
      return;
    }
    cur.forEach((sp, i) => { sp.set('smooth', el.current); sp.target = b[i]; });
    if (stop.current) return;   /* already running: it simply heads for the new targets */
    stop.current = loop((dt) => {
      let moving = false;
      for (const sp of cur) { sp.step(dt); if (sp.settled) sp.jump(sp.target); else moving = true; }
      const v = cur.map((sp) => sp.value), draw = painter?.current;
      /* settled: the end drawn in this frame, then rendered (a painter that finds what it needs missing hands the
         frame back to React) */
      if (!moving) { stop.current = null; draw?.(v); paint((n) => n + 1); return false; }
      if (!draw || draw(v) === false) paint((n) => n + 1);
      return true;
    });
  }, [key]);
  /* taken down (unmounted, or hidden by Activity or Suspense): the loop stops and is marked stopped, so a later change
     starts a new one. A layout effect: Suspense hiding a shown tree disconnects layout effects but keeps passive ones */
  useIsoLayoutEffect(() => () => { stop.current?.(); stop.current = null; }, []);
  /* the springs as they are (the target until they exist, or while its length changes and they are set up again) */
  const sample = () => { const cur = springs.current; return cur && cur.length === target.length ? cur.map((sp) => sp.value) : target; };
  return { now: sample(), sample, moving: stop.current !== null };
}

/** One transition for a whole chart's change: the scale, the gridlines and ticks, and the marks all move together
    from what is shown to the new state, on one progress that runs 0 → 1 at the personality's smooth pace without
    overshooting (a scale that swung past would misread the data mid-way). Values are in data units, so a resize
    redraws at once instead of tweening pixels. A change mid-way starts from what is shown. At once the first time,
    when the shape changes, and with reduced motion. `from` is the state the transition started from. */
/* rebase: where a new move starts from, given the move that was running (its from, to and progress) and what it drew
   (the plain interpolation); for a chart whose move is not one in units (a scale switch, drawn on the screen) */
type Rebase = (shownNow: number[], from: number[], to: number[], p: number) => number[];
/* tag: what else makes a new target (a scatter chart's scales: the same numbers on a linear and a log axis are not the
   same drawing) */
/* painter: draws a sample of the move straight into the chart's SVG. Given one, the loop calls it on every frame instead
   of rendering through React, and renders only when the move settles (#85): a render per frame waited for React's
   scheduler, which put it after the frame often enough for Firefox to hold a frame and then draw two steps at once,
   and rendering synchronously instead restarted every pending transition on each frame. The chart applies the same
   painter after each of its own commits (useFrame), so React's props never outlive a frame it drew */
type Painter = (now: number[], from: number[], p: number) => boolean | void;
function useMorph(target: number[], el: React.RefObject<Element | null>, rebase?: Rebase, tag = '', painter?: React.RefObject<Painter | null>): { now: number[]; from: number[]; p: number; sample: () => [number[], number[], number] } {
  const key = `${tag}|${target.join(',')}`;
  const st = useRef<{ from: number[]; to: number[]; key: string; P: Spring | null; stop: (() => void) | null }>({ from: target, to: target, key, P: null, stop: null });
  const [, paint] = useState(0);
  const lerp = (a: number[], b: number[], t: number) => b.map((v, i) => (a[i] ?? v) + (v - (a[i] ?? v)) * t);
  const p = st.current.P ? Math.min(1, Math.max(0, st.current.P.value)) : 1;
  useIsoLayoutEffect(() => {
    const m = st.current, mp = m.P ? Math.min(1, Math.max(0, m.P.value)) : 1, shownNow = lerp(m.from, m.to, mp);
    if (m.key === key) {
      /* set up again with the same target (shown after Activity or Suspense hid it): a change its hiding stopped
         half-way settles there rather than staying frozen (#82) */
      if (m.P && !m.stop) { m.P = null; m.from = m.to; paint((n) => n + 1); }
      return;
    }
    if (m.to.length !== target.length || prefersReducedMotion(el.current) || !el.current) {
      m.stop?.(); m.stop = null; m.P = null; m.from = m.to = target; m.key = key; paint((n) => n + 1);
      return;
    }
    m.from = m.P && rebase ? rebase(shownNow, m.from, m.to, mp) : shownNow; m.to = target; m.key = key;
    m.P = new Spring(0, { response: motionFor(el.current).smooth.response, damping: 1 });
    m.P.target = 1;
    paint((n) => n + 1);
    m.stop ??= loop((dt) => {
      const P = m.P; if (!P) { m.stop = null; return false; }
      P.step(dt);
      /* settled in progress units (the spring's own test is for pixels) */
      if (Math.abs(1 - P.value) < 0.001 && Math.abs(P.velocity) < 0.01) {
        /* the end drawn in this frame, then React prunes what only the move needed (fading ticks, emptied bars) */
        m.P = null; m.from = m.to; m.stop = null; painter?.current?.(m.to, m.to, 1); paint((n) => n + 1); return false;
      }
      /* a painter that finds what it needs missing hands the frame back to React */
      const q = Math.min(1, Math.max(0, P.value)), draw = painter?.current;
      if (!draw || draw(lerp(m.from, m.to, q), m.from, q) === false) paint((n) => n + 1);
    });
  }, [key]);
  /* taken down (unmounted, or hidden by Activity or Suspense): the loop stops and is marked stopped, so a later change
     starts a new one. A layout effect: Suspense hiding a shown tree disconnects layout effects but keeps passive ones */
  useIsoLayoutEffect(() => () => { const m = st.current; m.stop?.(); m.stop = null; }, []);
  const m = st.current;
  /* the move as it is now, read when it is drawn (after a commit, a render's own values can be frames old) */
  const sample = (): [number[], number[], number] => {
    const q = m.P ? Math.min(1, Math.max(0, m.P.value)) : 1;
    return [m.P ? lerp(m.from, m.to, q) : m.to, m.from, m.P ? q : 1];
  };
  return { now: m.P ? lerp(m.from, m.to, p) : m.to, from: m.from, p: m.P ? p : 1, sample };
}

/* ---- painting a move (#85): what the charts' painters share */
/** sets attributes on an element (null removes one); nothing when the element is not there */
function setAttrs(el: Element | null | undefined, a: Record<string, string | number | null>) {
  if (!el) return;
  for (const k in a) { const v = a[k]; if (v === null) el.removeAttribute(k); else el.setAttribute(k, String(v)); }
}
/** the gridlines and their labels (`g[data-grid]`: a line, then its text), as tickLayer places them; false when one
    is not mounted */
function paintGrid(svg: SVGSVGElement, grid: { t: number; o: number; y: number }[], left: number, iw: number): boolean {
  for (const { t, o, y } of grid) {
    const gl = svg.querySelector(`g[data-grid="${t}"]`);
    if (!gl) return false;
    setAttrs(gl, { opacity: o < 1 ? o.toFixed(3) : null });
    setAttrs(gl.firstElementChild, { x1: left, x2: left + iw, y1: y, y2: y });
    setAttrs(gl.lastElementChild, { x: left - 8, y });
  }
  return true;
}
/** the category labels (`text[data-xl]`, its index): where each one is, and whether it shows; false when one that
    shows is not mounted */
function paintLabels(svg: SVGSVGElement, count: number, xOf: (i: number) => number, shows: (i: number) => boolean): boolean {
  const els = svg.querySelectorAll<SVGTextElement>('text[data-xl]');
  let n = 0;
  for (const el of els) {
    const i = +(el.dataset.xl ?? 0), on = shows(i);
    setAttrs(el, { x: xOf(i), display: on ? null : 'none' });
    if (on) n++;
  }
  let want = 0;
  for (let i = 0; i < count; i++) if (shows(i)) want++;
  return n === want;
}
/** the tooltip, beside the point it reads */
function paintTip(box: HTMLElement | null, x: number, w: number) {
  const tip = box?.querySelector<HTMLElement>(':scope > .sg-chart__tip');
  if (tip) { tip.style.left = `${x}px`; tip.style.transform = tipShift(x, w); }
}
/** how many categories share a category label at a plot width: as many labels as fit, one per `per` px */
const strideAt = (iw: number, per: number, count: number) => Math.max(1, Math.ceil(count / Math.max(1, Math.floor(iw / per))));
/** whether a category's label is mounted while the plot's width moves through `iws` (its ends and now: the gutter moves
    one way): every stride that a width between them gives, found from how many labels fit, a handful at most however
    many categories there are (every whole number between the two strides was thousands for a long axis) */
function labelSteps(iws: number[], per: number, count: number): (i: number, shows: (i: number, step: number) => boolean) => boolean {
  const lo = Math.max(1, Math.floor(Math.min(...iws) / per)), hi = Math.max(1, Math.floor(Math.max(...iws) / per));
  const steps = new Set<number>();
  for (let n = lo; n <= hi; n++) steps.add(Math.max(1, Math.ceil(count / n)));
  return (i, shows) => { for (const k of steps) if (shows(i, k)) return true; return false; };
}
/** draws a chart's move after each of its commits and hands its painter to the move's frame loop. The painter is this
    render's (never one from a render React dropped), and what React just wrote is drawn over with the move as it is
    now. At rest, with nothing drawn by a frame since, React's own drawing stands (drawing it again cost a second pass
    on every hover) */
function usePainter<A extends unknown[]>(painter: React.RefObject<((...a: A) => boolean | void) | null>, draw: (...a: A) => boolean | void, sample: () => A, moving: boolean) {
  const framed = useRef(false);
  useIsoLayoutEffect(() => {
    painter.current = (...a: A) => { framed.current = true; return draw(...a); };
    if (moving || framed.current) { draw(...sample()); framed.current = moving; }
    return () => { painter.current = null; };
  });
}

/** Gridlines and their labels while the scale moves: the new ticks fade in, the old ones fade out, all placed on the
    scale as it is now. */
function tickLayer(next: number[], prev: number[], p: number): { t: number; o: number }[] {
  const all = new Map<number, number>();
  for (const t of next) all.set(t, prev.includes(t) ? 1 : p);
  if (p < 1) for (const t of prev) if (!all.has(t)) all.set(t, 1 - p);
  return [...all].map(([t, o]) => ({ t, o }));
}

/** a value to plot: a finite number (anything else is a gap) */
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** A series' values with each gap set on the straight line between the values around it (the nearest one at an
    end; `none` when the series has no value at all). */
function bridged(vals: unknown[], none: number): number[] {
  /* one pass: each gap is filled when the value after it is reached (a search per gap was quadratic on sparse series) */
  const out: number[] = new Array(vals.length);
  let prev = -1;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (!isNum(v)) continue;
    const a = prev < 0 ? v : (vals[prev] as number);
    for (let j = prev + 1; j < i; j++) out[j] = prev < 0 ? v : a + ((v - a) * (j - prev)) / (i - prev);
    out[i] = v; prev = i;
  }
  if (prev < 0) return vals.map(() => none);
  for (let j = prev + 1; j < vals.length; j++) out[j] = vals[prev] as number;
  return out;
}

/** Monotone cubic path through points (no overshoot between data points: a smooth line never invents a peak). */
function pathOf(pts: [number, number][], smooth: boolean): string {
  if (!pts.length) return '';
  if (!smooth || pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join('');
  const n = pts.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += `C${(x0 + h).toFixed(2)},${(y0 + h * t[i]).toFixed(2)} ${(x1 - h).toFixed(2)},${(y1 - h * t[i + 1]).toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

/* draw a line in once it is mounted (stroke offset on a normalised path length) */
function useDrawIn(ref: React.RefObject<SVGGElement | null>, deps: unknown[] = []) {
  useIsoLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    if (prefersReducedMotion(g)) { fade(g as unknown as HTMLElement, 0, 1, timing.appear); return; }
    /* the pace of the personality's 'gentle', never overshooting (a stroke drawn past its end would leave a gap) */
    const draw = { response: motionFor(g).gentle.response, damping: 1 };
    g.querySelectorAll<SVGPathElement>('[data-draw]').forEach((p, i) => { animate(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], draw, { delay: i * 60, fill: 'backwards' }); });
    g.querySelectorAll<SVGElement>('[data-fade]').forEach((p) => { animate(p, [{ opacity: 0 }, { opacity: 1 }], 'gentle', { delay: 200, fill: 'backwards' }); });
  }, deps);
}

type Active = number | null;
type ChartChromeProps = {
  label: string; series: ChartSeries[]; hidden: Set<string>; toggle: (k: string) => void; legend: boolean;
  /** the data table for screen readers (srTable), memoised by the chart on its data */
  table: ReactNode; announce: string; children: ReactNode; className?: string; style?: CSSProperties; caption?: ReactNode;
  /** the chart's resolved locale, for the words it writes */
  locale: string;
};
/** The full data as a table for screen readers. Each chart memoises it on its data, not on the animated values:
    a morph renders every frame, and rebuilding a row per datum each time made long series stutter. */
function srTable(label: string, head: string[], rows: { head: string; cells: string[] }[]): ReactNode {
  /* the wrapper holds the 1px box: a table grows to its content whatever width it is given, and a wide one (a scatter's four columns) made narrow pages scroll sideways */
  return (
    <div className="sg-visually-hidden"><table>
      <caption>{label}</caption>
      <thead><tr><th scope="col">{''}</th>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}><th scope="row">{r.head}</th>{r.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
function ChartChrome({ label, series, hidden, toggle, legend, table, announce, children, className, style, caption, locale }: ChartChromeProps) {
  return (
    <figure className={cx('sg-chart', className)} style={style} aria-label={label}>
      {legend && series.length > 1 && (
        <div className="sg-chart__legend" role="group" aria-label={messagesFor(locale).chartSeries(label)}>
          {series.map((s, i) => (
            <button key={s.key} type="button" className="sg-chart__key" aria-pressed={!hidden.has(s.key)} onClick={() => toggle(s.key)}>
              <span className="sg-chart__swatch" style={{ background: s.color ?? COLOR(i) }} aria-hidden="true" />{s.label}
            </button>
          ))}
        </div>
      )}
      {children}
      {caption && <figcaption className="sg-chart__caption">{caption}</figcaption>}
      <div className="sg-visually-hidden" aria-live="polite">{announce}</div>
      {table}
    </figure>
  );
}

function useHidden(series: ChartSeries[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const toggle = (k: string) => setHidden((h) => {
    const n = new Set(h);
    if (n.has(k)) n.delete(k); else if (series.length - n.size > 1) n.add(k);   /* at least one series stays */
    return n;
  });
  return [hidden, toggle] as const;
}

/** keyboard on a plot: ←/→ Home/End move the active index; Escape clears */
function plotKeys(e: KeyboardEvent, count: number, active: Active, set: (a: Active) => void) {
  const k = e.key;
  if (count <= 0) active = null;
  let n: number | null | undefined;
  if (k === 'ArrowRight' || k === 'ArrowDown') n = active === null ? 0 : Math.min(count - 1, active + 1);
  else if (k === 'ArrowLeft' || k === 'ArrowUp') n = active === null ? count - 1 : Math.max(0, active - 1);
  else if (k === 'Home') n = 0;
  else if (k === 'End') n = count - 1;
  else if (k === 'Escape') n = null;
  if (n === undefined) return;
  e.preventDefault();
  set(n !== null && n >= 0 && n < count ? n : null);   /* nothing to step to without data */
}

type TipRow = { color: string; label: string; value: string };
/* beside the point, on the side with more room */
const tipShift = (x: number, w: number) => `translate(${x > w * 0.6 ? 'calc(-100% - 12px)' : '12px'}, -50%)`;
function Tip({ x, y, w, title, rows }: { x: number; y: number; w: number; title: string; rows: TipRow[] }) {
  return (
    <div className="sg-chart__tip" aria-hidden="true" style={{ left: x, top: y, transform: tipShift(x, w) }}>
      <div className="sg-chart__tip-title">{title}</div>
      {rows.map((r) => <div key={r.label} className="sg-chart__tip-row">{r.color && <span className="sg-chart__swatch" style={{ background: r.color }} />}{r.label}<b>{r.value}</b></div>)}
    </div>
  );
}

const M = { top: 10, right: 12, bottom: 26 };
/** the active index while it still points into the data (data can shrink under a point being shown) */
const within = (active: Active, count: number): Active => (active !== null && active >= 0 && active < count ? active : null);
const yAxisWidth = (labels: string[]) => Math.max(28, Math.max(...labels.map((l) => l.length)) * 7 + 10);

/* ------------------------------------------------------------------------------------------------ LineChart */
export type LineChartProps = {
  /** one object per x position, in order: its label under `x` and each series' value under the series' key; a
      value that is not a number (null, missing) is a gap: the line breaks there, and a bar chart draws no bar */
  data: ChartDatum[];
  /** key of the x label in each datum */
  x: string;
  /** what to draw: each series' `key` in the data, its `label` (legend, tooltip, table) and `color` (default: the
      theme's chart colours, in order) */
  series: ChartSeries[];
  /** fill under the lines */
  area?: boolean;
  /** 'smooth' (monotone: it never overshoots a point) or 'linear' (straight segments) */
  curve?: 'smooth' | 'linear';
  /** start the y axis at zero (default: for areas) */
  zero?: boolean;
  /** the plot's height in px; the width follows the container */
  height?: number;
  /** writes the values on the axis, in the tooltip and in the table (default: the locale's numbers, compact from 10,000) */
  yFormat?: Fmt;
  /** writes the x labels (axis, tooltip, table; default: the label as it is in the data) */
  xFormat?: (v: string) => string;
  /** keys above the plot that hide and show series (with two or more) */
  legend?: boolean;
  /** BCP 47 locale for the default number formats and the words the chart writes (default: the ThemeProvider's
      `locale`, else 'en-US') */
  locale?: string;
  'aria-label': string;
  /** a note under the chart (source, units), its figcaption */
  caption?: ReactNode;
  className?: string; style?: CSSProperties;
};

export function LineChart({ data, x, series, area, curve = 'smooth', zero, height = 240, yFormat, xFormat: xFormatProp, legend = true, locale: localeProp, 'aria-label': label, caption, className, style }: LineChartProps) {
  const locale = useLocaleOf(localeProp);
  const fmt = yFormat ?? defaultFmt(locale), xFormat = xFormatProp ?? asIs;
  const [box, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const g = useRef<SVGGElement>(null);
  const [hidden, toggle] = useHidden(series);
  const [activeState, setActive] = useState<Active>(null);
  const active = within(activeState, data.length);
  /* a point the data no longer has is let go, so it does not come back when the data grows again */
  if (activeState !== null && active === null) setActive(null);
  const [kbd, setKbd] = useState(false);
  const gid = useStableId('sg-lc');
  const shown = series.filter((s) => !hidden.has(s.key));
  const vals = shown.flatMap((s) => data.map((d) => d[s.key]).filter(isNum));
  const [vlo, hi] = extent(vals), lo = Math.min(vlo, zero ?? area ? 0 : Infinity);
  const ticks = niceTicks(lo, hi, Math.max(2, Math.round(height / 56)));
  const axis = useAxisLabels(ticks, locale, yFormat), tickFmt = axis.fmt;
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  /* the gutter for the labels moves with the scale (useMorph): set at once, the plot jumped sideways when the labels'
     width changed (0.25 → 90) */
  const leftTo = yAxisWidth(ticks.map(tickFmt)), ih = height - M.top - M.bottom;
  /* the scale and every point (per series × point, in data units) move as one (useMorph). A gap stands on the
     straight line between its neighbours: unseen while it is a gap, and where a value that fills it rises from */
  const painter = useRef<Painter | null>(null);
  const morph = useMorph([y0, y1, ...series.flatMap((s) => bridged(data.map((d) => d[s.key]), y0)), leftTo], box, undefined, '', painter);
  const stepOf = (iw: number) => strideAt(iw, 72, data.length);
  /* every step-th label, plus the last one when it does not crowd its neighbour */
  const every = (i: number, k: number) => i % k === 0 || (i === data.length - 1 && i % k >= k / 2);
  /* everything that moves, for one sample of the move: React renders it, and the painter writes it on every frame of a
     move (#85) */
  const geom = (now: number[], from: number[], p: number) => {
    const left = now[now.length - 1];
    const iw = Math.max(10, width - left - M.right);
    const X = (i: number) => left + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const [sy0, sy1] = now, [py0, py1] = from;
    const Y = (v: number) => M.top + ih - ((v - sy0) / (sy1 - sy0 || 1)) * ih;
    const ys = now.slice(2, -1).map(Y);
    /* the ticks on screen when the axis changed fade out, each with the label it was drawn with */
    const grid = tickLayer(ticks, py0 === y0 && py1 === y1 ? ticks : axis.outgoing(p), p).map(({ t, o }) => ({ t, o, y: Y(t) }));
    const base = Y(Math.max(sy0, 0));
    /* nothing is drawn until the width is known (the server, the first render) */
    const lines = series.map((s, si) => {
      if (hidden.has(s.key) || measured === null) return null;
      /* a gap breaks the line and the area: one piece per run of values (the data as it is now, so a gap opens or
         closes at once and the points then move) */
      const runs: [number, number][][] = [];
      data.forEach((d, i) => {
        if (!isNum(d[s.key])) return;
        const pt: [number, number] = [X(i), ys[si * data.length + i] ?? Y(y0)];
        if (i > 0 && isNum(data[i - 1][s.key])) runs[runs.length - 1].push(pt); else runs.push([pt]);
      });
      /* a value alone between gaps is a dot: a zero-length piece drawn with the line's round caps */
      const line = runs.map((r) => pathOf(r, curve === 'smooth') + (r.length === 1 ? 'h0' : '')).join('');
      const fill = runs.filter((r) => r.length > 1).map((r) => `${pathOf(r, curve === 'smooth')}L${r[r.length - 1][0]},${base}L${r[0][0]},${base}Z`).join('');
      return { key: s.key, si, line, fill };
    });
    /* the crosshair's dots sit on the lines as drawn (on the target values, they left the line while it moved) */
    const dot = (si: number, i: number) => ys[si * data.length + i] ?? Y(y0);
    return { left, iw, X, grid, step: stepOf(iw), lines, dot };
  };
  const G = geom(morph.now, morph.from, morph.p), moving = morph.p < 1;
  const { left, iw, X } = G;
  /* while it moves, every label the moving gutter can make room for is mounted, and the painter shows the ones it does */
  const labelled = labelSteps(moving ? [Math.max(10, width - morph.from[morph.from.length - 1] - M.right), Math.max(10, width - leftTo - M.right), iw] : [iw], 72, data.length);
  const tickLabel = axis.label;
  useDrawIn(g, [measured !== null]);
  /* the layout as last drawn: what a pointer is over (React's at rest, the painter's while it moves) */
  const geo = useRef(G);
  useIsoLayoutEffect(() => { geo.current = G; });
  /* draws a sample into what React mounted; false when it needs something that is not there (React renders instead) */
  const draw = (now: number[], from: number[], p: number): boolean => {
    const svg = box.current?.querySelector('svg');
    if (!svg) return true;
    const D = geom(now, from, p);
    geo.current = D;
    if (!paintGrid(svg, D.grid, D.left, D.iw)) return false;
    if (!paintLabels(svg, data.length, D.X, (i) => every(i, D.step))) return false;
    /* by the key as data, not in a selector (a key can hold what a selector cannot) */
    const groups = new Map([...svg.querySelectorAll<SVGGElement>('g[data-k]')].map((el) => [el.dataset.k, el]));
    for (const l of D.lines) {
      if (!l) continue;
      const sg = groups.get(l.key);
      if (!sg) return false;
      setAttrs(sg.querySelector('[data-draw]'), { d: l.line });
      const f = sg.querySelector('[data-fade]');
      if (f) setAttrs(f, { d: l.fill }); else if (area && l.fill) return false;
    }
    if (active !== null) {
      setAttrs(svg.querySelector('.sg-chart__cross line'), { x1: D.X(active), x2: D.X(active) });
      for (const c of svg.querySelectorAll<SVGCircleElement>('.sg-chart__cross circle')) setAttrs(c, { cx: D.X(active), cy: D.dot(+(c.dataset.si ?? 0), active) });
      paintTip(box.current, D.X(active), width);
    }
    return true;
  };
  usePainter(painter, draw, morph.sample, moving);
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), at = geo.current;
    const px = e.clientX - r.left;
    setKbd(false);
    setActive(data.length ? Math.max(0, Math.min(data.length - 1, Math.round(((px - at.left) / at.iw) * (data.length - 1)))) : null);
  };
  const cell = (v: ChartDatum[string]) => (isNum(v) ? fmt(v) : '—');
  const rowsFor = (i: number) => shown.map((s) => ({ color: s.color ?? COLOR(series.indexOf(s)), label: s.label, value: cell(data[i][s.key]) }));
  const announce = kbd && active !== null ? `${xFormat(String(data[active][x]))}: ${rowsFor(active).map((r) => `${r.label} ${r.value}`).join(', ')}` : '';
  /* keyed on the formatters too: the defaults are kept at module level, but an app's inline one is new on every render */
  const table = useMemo(() => srTable(label, series.map((s) => s.label), data.map((d) => ({ head: xFormat(String(d[x])), cells: series.map((s) => cell(d[s.key])) }))), [label, series, data, x, xFormat, fmt]);
  return (
    <ChartChrome label={label} locale={locale} series={series} hidden={hidden} toggle={toggle} legend={legend} announce={announce} caption={caption} className={className} style={style}
      table={table}>
      <div ref={box} className="sg-chart__plot" tabIndex={0} role="img" aria-label={label}
        onPointerMove={onMove} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}
        onKeyDown={(e) => { setKbd(true); plotKeys(e, data.length, active, setActive); }}>
        {measured === null ? <div style={{ height }} /> : <svg width={width} height={height} aria-hidden="true">
          <defs>{series.map((s, i) => (
            <linearGradient key={s.key} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color ?? COLOR(i)} stopOpacity="0.22" /><stop offset="1" stopColor={s.color ?? COLOR(i)} stopOpacity="0" /></linearGradient>
          ))}</defs>
          {G.grid.map(({ t, o, y }) => <g key={t} data-grid={t} opacity={o < 1 ? o.toFixed(3) : undefined}><line className="sg-chart__grid" x1={left} x2={left + iw} y1={y} y2={y} /><text className="sg-chart__tick" x={left - 8} y={y} dy="0.35em" textAnchor="end">{tickLabel(t)}</text></g>)}
          {data.map((d, i) => labelled(i, every) ? (
            <text key={i} data-xl={i} className="sg-chart__tick" x={X(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} display={every(i, G.step) ? undefined : 'none'}>{xFormat(String(d[x]))}</text>
          ) : null)}
          <g ref={g}>
            {G.lines.map((l) => l && (
              <g key={l.key} data-k={l.key} style={{ color: series[l.si].color ?? COLOR(l.si) }}>
                {area && l.fill && <path data-fade d={l.fill} fill={`url(#${gid}-${l.si})`} />}
                <path data-draw className="sg-chart__line" d={l.line} pathLength={1} />
              </g>
            ))}
          </g>
          {active !== null && (
            <g className="sg-chart__cross">
              <line x1={X(active)} x2={X(active)} y1={M.top} y2={M.top + ih} />
              {shown.map((s) => { const si = series.indexOf(s); return isNum(data[active][s.key]) ? <circle key={s.key} data-si={si} cx={X(active)} cy={G.dot(si, active)} r={4} style={{ fill: s.color ?? COLOR(si) }} /> : null; })}
            </g>
          )}
        </svg>}
        {active !== null && <Tip x={X(active)} y={M.top + ih / 2} w={width} title={xFormat(String(data[active][x]))} rows={rowsFor(active)} />}
      </div>
    </ChartChrome>
  );
}

/* ------------------------------------------------------------------------------------------------ ScatterChart */
/* (0.6) Two measures of the same things — quality against cost, speed against size: one point per item, placed on
   two numeric axes (linear, or log when the values span orders of magnitude, as prices do). Points can belong to
   groups (a colour each and a legend that hides and shows them); `highlight` picks some out by name — drawn larger
   and labelled, the rest recede — for "the ones I am comparing". The pointer finds the nearest point; arrow keys
   walk the points from left to right; the data table lists every point. Points pop in on 'pop'; new data and a new
   scale move together on one spring (as the other charts). */
export type ScatterChartProps = {
  /** one object per point: its two values under `x` and `y` and its name under `pointLabel`; a point without both
      numbers (or not above 0 on a log axis) is left out */
  data: ChartDatum[];
  /** key of the value on the horizontal axis */
  x: string;
  /** key of the value on the vertical axis */
  y: string;
  /** key of each point's name (tooltip, labels, the data table) */
  pointLabel: string;
  /** key whose value puts a point in a group; `groups` names them (key = that value), colours and orders them */
  group?: string;
  /** the groups, in legend order: `key` is a value of the `group` field, with its `label` and `color` (default:
      none: every point takes the first chart colour, and the tooltip names its group by the value) */
  groups?: ChartSeries[];
  /** names of points to pick out */
  highlight?: string[];
  /** 'log' for values that span orders of magnitude, such as prices (only values above 0 are plotted) */
  xScale?: 'linear' | 'log';
  /** 'log' for values that span orders of magnitude, such as prices (only values above 0 are plotted) */
  yScale?: 'linear' | 'log';
  /** the horizontal axis's title (also a data table column) */
  xLabel?: string;
  /** the vertical axis's title (also a data table column) */
  yLabel?: string;
  /** writes the x values (axis, tooltip, table; default: the locale's numbers, compact from 10,000) */
  xFormat?: Fmt;
  /** writes the y values (axis, tooltip, table; default: the locale's numbers, compact from 10,000) */
  yFormat?: Fmt;
  /** the plot's height in px; the width follows the container */
  height?: number;
  /** keys above the plot that hide and show groups (with two or more) */
  legend?: boolean;
  /** BCP 47 locale for the default number formats and the words the chart writes (default: the ThemeProvider's
      `locale`, else 'en-US') */
  locale?: string;
  'aria-label': string;
  /** a note under the chart (source, units), its figcaption */
  caption?: ReactNode;
  className?: string; style?: CSSProperties;
};

type Axis = { lo: number; hi: number; ticks: number[] };
const lg = Math.log10;
/* 1 · 2 · 5 per decade; only the powers of ten when that is too many */
function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  /* only a real, positive range of a sane span (a range in another scale's units can reach Infinity and never end the loop) */
  if (!(lo > 0) || !isFinite(hi) || hi < lo || lg(hi) - lg(lo) > 40) return out;
  for (let d = Math.floor(lg(lo)); d <= Math.ceil(lg(hi)); d++) for (const m of [1, 2, 5]) { const v = +(m * 10 ** d).toPrecision(6); if (v >= lo && v <= hi) out.push(v); }
  return out.length > 7 ? out.filter((v) => Math.abs(lg(v) - Math.round(lg(v))) < 1e-9) : out;
}
/* an axis in its own units (log10 for a log scale) with its ticks in data units */
function axisOf(vals: number[], log: boolean, count: number): Axis {
  if (log) {
    const pos = vals.filter((v) => v > 0);
    if (!pos.length) return { lo: 0, hi: 1, ticks: [1, 10] };
    let [a, b] = extent(pos);
    if (a === b) { a /= 2; b *= 2; }
    const pad = (lg(b) - lg(a)) * 0.06;
    return { lo: lg(a) - pad, hi: lg(b) + pad, ticks: logTicks(10 ** (lg(a) - pad), 10 ** (lg(b) + pad)) };
  }
  const [a, b] = extent(vals);
  const t = niceTicks(vals.length ? a : 0, vals.length ? b : 1, count);
  return { lo: t[0], hi: t[t.length - 1], ticks: t };
}

/* a scatter chart's ticks as a move draws them on the screen, at one point of it: each tick drawn, with its place (a
   fraction of the plot), its opacity and its label. Values, not functions, so a chain of them costs nothing */
type Carry = Map<number, { f: number; o: number; label: string }>;
type Shown = { target: string; xl: boolean; yl: boolean; fromX: boolean; fromY: boolean; ticksX: number[]; ticksY: number[]; labelX: (t: number) => string; labelY: (t: number) => string; carryX: Carry | null; carryY: Carry | null };
/* where a carried tick is drawn at progress p of a move from `from` to `to` (bounds at k): across a switch, on the screen
   (as the points are), from its place f0 to its place on the new axis; else in units (as the points are, so a point and
   its gridline stay together), from the value at f0 on the old bounds to its own value, on the moving scale. A tick
   with no place on the new axis (0 on a log one) stays where it is drawn, leaving */
function carriedPlace(f0: number, v1: number, switched: boolean, from: number[], to: number[], k: number, p: number): number {
  if (switched) { const b = (v1 - to[k]) / (to[k + 1] - to[k] || 1); return isFinite(b) ? f0 + (b - f0) * p : f0; }
  if (!isFinite(v1)) return f0;
  const lo = from[k] + (to[k] - from[k]) * p, hi = from[k + 1] + (to[k + 1] - from[k + 1]) * p;
  const t0 = from[k] + f0 * (from[k + 1] - from[k]);
  return (t0 + (v1 - t0) * p - lo) / (hi - lo || 1);
}
/* the running move's ticks on one axis at progress p, when it draws them on the screen (a switch, or ticks carried from
   an earlier such move); null for a move in units, whose ticks fade as usual. A tick not drawn (no place there, 0 on a
   log axis; well outside the plot, where it is clipped; or faded out) is left out: one the next move shows fades in.
   Near the edge it is kept (the plot shows a pixel past it; what shows is the renderer's to decide) */
function drawnTicks(s: Shown, axis: 0 | 1, from: number[], to: number[], p: number): Carry | null {
  const k = axis * 2, log0 = axis ? s.fromY : s.fromX, log1 = axis ? s.yl : s.xl, ticks = axis ? s.ticksY : s.ticksX;
  const c = axis ? s.carryY : s.carryX, label = axis ? s.labelY : s.labelX;
  const u = (v: number, log: boolean) => (log ? lg(v) : v);
  const end = (t: number) => (u(t, log1) - to[k]) / (to[k + 1] - to[k] || 1);
  if (!c && log0 === log1) return null;
  const out: Carry = new Map();
  const keep = (t: number, f: number, o: number, l: string) => { if (o > 0.001 && isFinite(f) && f >= -0.05 && f <= 1.05) out.set(t, { f, o, label: l }); };
  if (c) {
    for (const t of new Set([...ticks, ...c.keys()])) {
      const e = c.get(t), mine = ticks.includes(t), o0 = e ? e.o : 0;
      /* one not carried is drawn as the move draws a new tick: at its place, or on the moving scale */
      const lo = from[k] + (to[k] - from[k]) * p, hi = from[k + 1] + (to[k + 1] - from[k + 1]) * p;
      const f = e ? carriedPlace(e.f, u(t, log1), log0 !== log1, from, to, k, p) : log0 !== log1 ? end(t) : (u(t, log1) - lo) / (hi - lo || 1);
      keep(t, f, mine ? o0 + (1 - o0) * p : o0 * (1 - p), mine || !e ? label(t) : e.label);
    }
  } else {
    for (const t of ticks) { const a = (u(t, log0) - from[k]) / (from[k + 1] - from[k] || 1), b = end(t); keep(t, isFinite(a) ? a + (b - a) * p : b, p, label(t)); }
  }
  return out;
}

export function ScatterChart({ data, x, y, pointLabel, group, groups: groupsProp, highlight, xScale = 'linear', yScale = 'linear', xLabel = x, yLabel = y, xFormat, yFormat, height = 280, legend = true, locale: localeProp, 'aria-label': label, caption, className, style }: ScatterChartProps) {
  const locale = useLocaleOf(localeProp);
  const fx = xFormat ?? defaultFmt(locale), fy = yFormat ?? defaultFmt(locale), groups = groupsProp ?? NO_GROUPS;
  const [box, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const g = useRef<SVGGElement>(null);
  const [hidden, toggle] = useHidden(groups);
  const [activeState, setActive] = useState<Active>(null);
  const [kbd, setKbd] = useState(false);
  const xl = xScale === 'log', yl = yScale === 'log';
  const num = (d: ChartDatum, k: string, log: boolean) => { const v = d[k]; return typeof v === 'number' && isFinite(v) && (!log || v > 0) ? v : null; };
  const gi = (d: ChartDatum) => (group ? groups.findIndex((s) => s.key === String(d[group])) : -1);
  const colorOf = (d: ChartDatum) => { const i = gi(d); return i >= 0 ? groups[i].color ?? COLOR(i) : COLOR(0); };
  const onShow = (d: ChartDatum) => !group || !hidden.has(String(d[group]));
  const plotted = data.map((d, i) => i).filter((i) => num(data[i], x, xl) !== null && num(data[i], y, yl) !== null);
  const visible = plotted.filter((i) => onShow(data[i]));
  /* a point that is no longer drawn (new data, a hidden group) is not shown or stepped from */
  const active = activeState !== null && visible.includes(activeState) ? activeState : null;
  /* a point the data no longer has is let go, so it does not come back when the data grows again */
  if (activeState !== null && active === null) setActive(null);
  const count = Math.max(2, Math.round(height / 56));
  const ax = axisOf(visible.map((i) => num(data[i], x, xl)!), xl, Math.max(2, Math.round(width / 110)));
  const ay = axisOf(visible.map((i) => num(data[i], y, yl)!), yl, count);
  /* tick labels at the step's precision on a linear axis; a log axis's ticks are whole powers, read as values */
  const xAxis = useAxisLabels(ax.ticks, locale, xFormat ?? (xl ? fx : undefined)), yAxis = useAxisLabels(ay.ticks, locale, yFormat ?? (yl ? fy : undefined));
  const tfy = yAxis.fmt;
  const u = (v: number, log: boolean) => (log ? lg(v) : v);
  const top = M.top + (yLabel ? 16 : 0), bottom = M.bottom + (xLabel ? 18 : 0);
  const leftTo = yAxisWidth(ay.ticks.map(tfy)), ih = height - top - bottom;
  /* the two scales and every point (in axis units) move as one */
  const mt = [ax.lo, ax.hi, ay.lo, ay.hi, ...data.flatMap((d) => [u(num(d, x, xl) ?? (xl ? 1 : 0), xl), u(num(d, y, yl) ?? (yl ? 1 : 0), yl)]), leftTo];
  /* the whole move's target with its scales: any new target (new bounds, a switch with the same bounds, new values within the
     same bounds) is a new entry, so a settled switch is not taken for one still running */
  const target = `${xl},${yl},${mt.join(',')}`;
  /* the scales as last committed, the ones the move to them started from, their ticks, and the ticks as they were drawn
     when the move began (see below) */
  const shown = useRef<Shown>({ target, xl, yl, fromX: xl, fromY: yl, ticksX: ax.ticks, ticksY: ay.ticks, labelX: String, labelY: String, carryX: null, carryY: null });
  /* the ticks' drawing carried into a move that starts while another is drawn on the screen, until it is committed */
  const carried = useRef<{ x: Carry | null; y: Carry | null }>({ x: null, y: null });
  /* new data while a switch is moving the points (#102): a switched axis's move is drawn on the screen, not in units,
     so the next move starts from where each point is drawn, put in the units of the scale it was moving to (the one
     committed, which the new move continues from). Its ticks, drawn on the screen too, carry on from where they are
     drawn and as faded as they are. Run when the new move starts, before the committed scales are updated, so
     shown.current is still the move that was running */
  const rebase: Rebase = (now, from, to, p) => {
    const s = shown.current, out = now.slice();
    const onScreen = (axis: 0 | 1) => {
      const k = axis * 2, lo0 = from[k], hi0 = from[k + 1], lo1 = to[k], hi1 = to[k + 1];
      out[k] = lo1; out[k + 1] = hi1;
      for (let j = 4 + axis; j < to.length - 1; j += 2) {
        const b = (to[j] - lo1) / (hi1 - lo1 || 1), a = (from[j] - lo0) / (hi0 - lo0 || 1);
        out[j] = lo1 + (isFinite(a) ? a + (b - a) * p : b) * (hi1 - lo1);
      }
    };
    if (s.fromX !== s.xl) onScreen(0);
    if (s.fromY !== s.yl) onScreen(1);
    carried.current = { x: drawnTicks(s, 0, from, to, p), y: drawnTicks(s, 1, from, to, p) };
    return out;
  };
  /* above the layout effect that commits `shown` (below): useMorph's own layout effect runs first and calls rebase,
     which reads the move still running from `shown` and leaves `carried` for that effect to take */
  const painter = useRef<Painter | null>(null);
  const morph = useMorph(mt, box, rebase, `${xl},${yl}`, painter);
  /* the scale the move started from: after a switch between linear and log the old range is in the other scale's units, so its
     ticks are not drawn again (they would be read in the new units); the new ticks fade in as the axis moves */
  /* the scales as last committed, and the ones the move to them started from: written in a layout effect, so a render
     React starts and then discards (a transition that suspends, an interrupted one) leaves them as shown (#83). A new
     target, not committed yet, moves from the scales on screen */
  const fromX = shown.current.target === target ? shown.current.fromX : shown.current.xl;
  const fromY = shown.current.target === target ? shown.current.fromY : shown.current.yl;
  useIsoLayoutEffect(() => {
    const s = shown.current, c = carried.current;
    carried.current = { x: null, y: null };
    if (s.target !== target) shown.current = { target, xl, yl, fromX: s.xl, fromY: s.yl, ticksX: ax.ticks, ticksY: ay.ticks, labelX: xLabelOf, labelY: yLabelOf, carryX: c.x, carryY: c.y };
    /* the same target, laid out again (a resize can change the ticks with the same bounds): the ticks and their labels
       as drawn now */
    else Object.assign(s, { ticksX: ax.ticks, ticksY: ay.ticks, labelX: xLabelOf, labelY: yLabelOf });
  });
  /* ticks carried from a move drawn on the screen: each from where it is drawn to its place on the new scale, and from
     as faded as it is to shown (a tick of the new scale) or gone */
  const cX = shown.current.target === target ? shown.current.carryX : null, cY = shown.current.target === target ? shown.current.carryY : null;
  /* a carried tick leaving keeps the label it was drawn with */
  const carriedLabel = (c: Carry | null, next: number[], own: (t: number) => string) => (t: number) => (c && !next.includes(t) ? c.get(t)?.label ?? own(t) : own(t));
  const xSwitched = fromX !== xl, ySwitched = fromY !== yl;
  const xLabelOf = xAxis.label, yLabelOf = yAxis.label;
  const xTickLabel = carriedLabel(cX, ax.ticks, xLabelOf), yTickLabel = carriedLabel(cY, ay.ticks, yLabelOf);
  const picked = new Set(highlight ?? []);
  const name = (i: number) => String(data[i][pointLabel] ?? '');
  /* the label's width at 12 px, near enough: wide (CJK) characters about 12 px, others about 7 */
  const tw = (t: string) => [...t].reduce((a, c) => a + (c.charCodeAt(0) > 0x1100 ? 12 : 7), 4);
  /* everything that moves, for one sample of the move: React renders it, and the painter writes it on every frame of a
     move (#85) */
  const geom = (now: number[], from: number[], p: number) => {
    /* the gutter moves with the scales */
    const left = now[now.length - 1], iw = Math.max(10, width - left - M.right);
    const [sx0, sx1, sy0, sy1] = now, [px0, px1, py0, py1] = from;
    const X = (uv: number) => left + ((uv - sx0) / (sx1 - sx0 || 1)) * iw;
    const Y = (uv: number) => top + ih - ((uv - sy0) / (sy1 - sy0 || 1)) * ih;
    /* a tick not carried (not drawn then) is drawn as the move draws a new one, fading in: at its place across a switch,
       else on the moving scale */
    const carriedAt = (c: Carry, t: number, axis: 0 | 1, log: boolean, switched: boolean) => {
      const k = axis * 2, e = c.get(t);
      if (e) return carriedPlace(e.f, u(t, log), switched, from, mt, k, p);
      const lo = now[k], hi = now[k + 1];
      return switched ? (u(t, log) - mt[k]) / (mt[k + 1] - mt[k] || 1) : (u(t, log) - lo) / (hi - lo || 1);
    };
    const carriedLayer = (c: Carry, next: number[]) => [...new Set([...next, ...c.keys()])]
      .map((t) => { const o0 = c.get(t)?.o ?? 0; return { t, o: next.includes(t) ? o0 + (1 - o0) * p : o0 * (1 - p) }; });
    /* across a switch the two ranges are in different units (log10 4–5 against 0–100,000), and a move in units would be all one or
       the other; so a switched axis moves on the screen instead: each point and tick from its place on the old axis to its place on
       the new one, on the move's progress */
    const along = (v: number, was: boolean, lo0: number, hi0: number, is: boolean, lo1: number, hi1: number) => {
      const b = (u(v, is) - lo1) / (hi1 - lo1 || 1), a = (u(v, was) - lo0) / (hi0 - lo0 || 1);
      return isFinite(a) ? a + (b - a) * p : b;
    };
    const xAt = (v: number) => left + along(v, fromX, px0, px1, xl, ax.lo, ax.hi) * iw;
    const yAt = (v: number) => top + ih - along(v, fromY, py0, py1, yl, ay.lo, ay.hi) * ih;
    /* a point across a switch starts from where it was drawn: its value at the move's start (from, in the old axis's
       units), not its new value read on the old axis, a place it never had (new data with the switch, or while hidden) */
    const fromAlong = (f: number, v: number, lo0: number, hi0: number, is: boolean, lo1: number, hi1: number) => {
      const b = (u(v, is) - lo1) / (hi1 - lo1 || 1), a = (f - lo0) / (hi0 - lo0 || 1);
      return isFinite(a) ? a + (b - a) * p : b;
    };
    const tx = (t: number) => (cX ? left + carriedAt(cX, t, 0, xl, xSwitched) * iw : xSwitched ? xAt(t) : X(u(t, xl)));
    const ty = (t: number) => (cY ? top + ih - carriedAt(cY, t, 1, yl, ySwitched) * ih : ySwitched ? yAt(t) : Y(u(t, yl)));
    const pos = (i: number): [number, number] => [
      xSwitched ? left + fromAlong(from[4 + i * 2], num(data[i], x, xl)!, px0, px1, xl, ax.lo, ax.hi) * iw : X(now[4 + i * 2]),
      ySwitched ? top + ih - fromAlong(from[5 + i * 2], num(data[i], y, yl)!, py0, py1, yl, ay.lo, ay.hi) * ih : Y(now[5 + i * 2]),
    ];
    /* while a switch moves them, ticks outside the plot are not drawn, nor carried ones faded out */
    const inX = (t: number) => { const v = tx(t); return isFinite(v) && v >= left - 1 && v <= left + iw + 1; };
    const inY = (t: number) => { const v = ty(t); return isFinite(v) && v >= top - 1 && v <= top + ih + 1; };
    const prevX = xSwitched ? [] : px0 === ax.lo && px1 === ax.hi ? ax.ticks : xAxis.outgoing(p);
    const prevY = ySwitched ? [] : py0 === ay.lo && py1 === ay.hi ? ay.ticks : yAxis.outgoing(p);
    const gridY = (cY ? carriedLayer(cY, ay.ticks) : tickLayer(ay.ticks, prevY, p)).map(({ t, o }) => ({ t, o, at: ty(t), on: (!cY || o > 0.001) && inY(t) }));
    const gridX = (cX ? carriedLayer(cX, ax.ticks) : tickLayer(ax.ticks, prevX, p)).map(({ t, o }) => ({ t, o, at: tx(t), on: (!cX || o > 0.001) && inX(t) }));
    /* names of the picked points: beside the point (left of it near the right edge); a name that would cover one
       already placed moves down a line, so points close together keep both names readable */
    const labels: { i: number; x: number; y: number; flip: boolean }[] = [];
    for (const i of plotted) {
      if (!onShow(data[i]) || !picked.has(name(i)) || measured === null) continue;
      const [cx, cy] = pos(i), flip = cx > left + iw * 0.75, w = tw(name(i));
      const lx = cx + (flip ? -10 : 10), x0 = flip ? lx - w : lx, x1 = flip ? lx : lx + w;
      let ly = cy;
      for (let n = 0; n < labels.length + 1; n++) {
        const hit = labels.find((l) => { const w2 = tw(name(l.i)), a0 = l.flip ? l.x - w2 : l.x, a1 = l.flip ? l.x : l.x + w2; return a0 < x1 && x0 < a1 && Math.abs(l.y - ly) < 15; });
        if (!hit) break;
        ly = hit.y + 15;
      }
      labels.push({ i, x: lx, y: ly, flip });
    }
    return { left, iw, pos, gridX, gridY, labels };
  };
  const G = geom(morph.now, morph.from, morph.p), moving = morph.p < 1;
  const { left, iw, pos } = G;
  /* the layout as last drawn: what a pointer is over (React's at rest, the painter's while it moves) */
  const geo = useRef(G);
  useIsoLayoutEffect(() => { geo.current = G; });
  /* draws a sample into what React mounted; false when it needs something that is not there (React renders instead) */
  const draw = (now: number[], from: number[], p: number): boolean => {
    const svg = box.current?.querySelector('svg');
    if (!svg) return true;
    const D = geom(now, from, p);
    geo.current = D;
    for (const [axis, grid] of [['y', D.gridY], ['x', D.gridX]] as const) for (const { t, o, at, on } of grid) {
      const gl = svg.querySelector(`g[data-grid="${axis}${t}"]`);
      if (!gl) { if (on) return false; continue; }
      setAttrs(gl, { opacity: o < 1 ? o.toFixed(3) : null, display: on ? null : 'none' });
      if (axis === 'y') { setAttrs(gl.firstElementChild, { x1: D.left, x2: D.left + D.iw, y1: at, y2: at }); setAttrs(gl.lastElementChild, { x: D.left - 8, y: at }); }
      else { setAttrs(gl.firstElementChild, { x1: at, x2: at }); setAttrs(gl.lastElementChild, { x: at }); }
    }
    setAttrs(svg.querySelector('[data-title=y]'), { x: D.left });
    setAttrs(svg.querySelector('[data-title=x]'), { x: D.left + D.iw });
    for (const c of svg.querySelectorAll<SVGCircleElement>('circle[data-pop]')) { const [cx, cy] = D.pos(+(c.dataset.i ?? 0)); setAttrs(c, { cx, cy }); }
    const names = svg.querySelectorAll<SVGTextElement>('text[data-name]');
    if (names.length !== D.labels.length) return false;
    D.labels.forEach((l, k) => setAttrs(names[k], { x: l.x, y: l.y, 'text-anchor': l.flip ? 'end' : 'start' }));
    if (active !== null) paintTip(box.current, D.pos(active)[0], width);
    const tip = box.current?.querySelector<HTMLElement>(':scope > .sg-chart__tip');
    if (tip && active !== null) tip.style.top = `${D.pos(active)[1]}px`;
    return true;
  };
  usePainter(painter, draw, morph.sample, moving);
  /* entrance: the points pop in from left to right */
  useIsoLayoutEffect(() => {
    const el = g.current;
    if (!el) return;
    if (prefersReducedMotion(el)) { fade(el as unknown as HTMLElement, 0, 1, timing.appear); return; }
    const pts = Array.from(el.querySelectorAll<SVGElement>('[data-pop]'));
    const order = pts.map((p, k) => [k, +(p.getAttribute('cx') ?? 0)] as const).sort((a, b) => a[1] - b[1]).map(([k]) => k);
    order.forEach((k, n) => { animate(pts[k], [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], 'pop', { delay: Math.min(n * 12, 300), fill: 'backwards' }); });
  }, [measured !== null]);
  /* keys walk the points left to right, as they are drawn (they cross while they move) */
  const byX = () => { const at = geo.current; return [...visible].sort((a, b) => at.pos(a)[0] - at.pos(b)[0]); };
  const onMove = (e: ReactPointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), at = geo.current;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best: number | null = null, bd = 28 * 28;
    for (const i of visible) { const [px, py] = at.pos(i), d = (px - mx) ** 2 + (py - my) ** 2; if (d < bd) { bd = d; best = i; } }
    setKbd(false);
    setActive(best);
  };
  const rowsFor = (i: number): TipRow[] => [
    ...(group ? [{ color: colorOf(data[i]), label: groups[gi(data[i])]?.label ?? String(data[i][group]), value: '' }] : []),
    { color: '', label: xLabel, value: fx(num(data[i], x, xl)!) },
    { color: '', label: yLabel, value: fy(num(data[i], y, yl)!) },
  ];
  const announce = kbd && active !== null ? `${name(active)}: ${xLabel} ${fx(num(data[active], x, xl)!)}, ${yLabel} ${fy(num(data[active], y, yl)!)}` : '';
  const cell = (d: ChartDatum, k: string, f: Fmt) => (typeof d[k] === 'number' ? f(d[k] as number) : '—');
  const table = useMemo(() => srTable(label, [xLabel, yLabel, ...(group ? [''] : [])],
    data.map((d) => ({ head: String(d[pointLabel] ?? ''), cells: [cell(d, x, fx), cell(d, y, fy), ...(group ? [groups[gi(d)]?.label ?? String(d[group] ?? '')] : [])] }))),
  [label, data, x, y, pointLabel, group, groups, xLabel, yLabel, fx, fy]);
  /* while it moves, every tick the move can draw is mounted and the painter shows the ones it does */
  const mounted = (q: { on: boolean }) => q.on || moving;
  return (
    <ChartChrome label={label} locale={locale} series={groups} hidden={hidden} toggle={toggle} legend={legend && !!group} announce={announce} caption={caption} className={className} style={style}
      table={table}>
      <div ref={box} className="sg-chart__plot sg-scatter" tabIndex={0} role="img" aria-label={label}
        onPointerMove={onMove} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}
        onKeyDown={(e) => { setKbd(true); const order = byX(), at = active === null ? null : order.indexOf(active); plotKeys(e, order.length, at !== null && at >= 0 ? at : null, (n) => setActive(n === null ? null : order[n] ?? null)); }}>
        {measured === null ? <div style={{ height }} /> : <svg width={width} height={height} aria-hidden="true">
          {G.gridY.filter(mounted).map(({ t, o, at, on }) => <g key={`y${t}`} data-grid={`y${t}`} opacity={o < 1 ? o.toFixed(3) : undefined} display={on ? undefined : 'none'}><line className="sg-chart__grid" x1={left} x2={left + iw} y1={at} y2={at} /><text className="sg-chart__tick" x={left - 8} y={at} dy="0.35em" textAnchor="end">{yTickLabel(t)}</text></g>)}
          {G.gridX.filter(mounted).map(({ t, o, at, on }) => <g key={`x${t}`} data-grid={`x${t}`} opacity={o < 1 ? o.toFixed(3) : undefined} display={on ? undefined : 'none'}><line className="sg-chart__grid" x1={at} x2={at} y1={top} y2={top + ih} /><text className="sg-chart__tick" x={at} y={top + ih + 16} textAnchor="middle">{xTickLabel(t)}</text></g>)}
          {yLabel && <text data-title="y" className="sg-chart__axis-title" x={left} y={M.top + 2} dy="0.35em" textAnchor="start">{yLabel}</text>}
          {xLabel && <text data-title="x" className="sg-chart__axis-title" x={left + iw} y={height - 4} textAnchor="end">{xLabel}</text>}
          <g ref={g} data-picking={picked.size > 0 || undefined}>
            {plotted.map((i) => {
              if (!onShow(data[i])) return null;
              const [cx, cy] = pos(i), on = picked.has(name(i));
              return <circle key={i} data-pop data-i={i} className="sg-scatter__point" data-picked={on || undefined} data-active={active === i || undefined} cx={cx} cy={cy} r={on ? 6.5 : 5} style={{ fill: colorOf(data[i]) }} />;
            })}
            {G.labels.map((l) => <text key={`l${l.i}`} data-name className="sg-scatter__label" x={l.x} y={l.y} dy="0.35em" textAnchor={l.flip ? 'end' : 'start'}>{name(l.i)}</text>)}
          </g>
        </svg>}
        {active !== null && measured !== null && <Tip x={pos(active)[0]} y={pos(active)[1]} w={width} title={name(active)} rows={rowsFor(active)} />}
      </div>
    </ChartChrome>
  );
}

/* ------------------------------------------------------------------------------------------------ BarChart */
export type BarChartProps = Omit<LineChartProps, 'area' | 'curve' | 'zero'> & {
  /** one bar per category with the series stacked in it, instead of side by side */
  stacked?: boolean;
};

/* a bar standing on the baseline: square at the foot, its top corners rounded by r (as far as its size allows) */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  if (w <= 0 || h <= 0) return '';
  r = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`;
}

export function BarChart({ data, x, series, stacked, height = 240, yFormat, xFormat: xFormatProp, legend = true, locale: localeProp, 'aria-label': label, caption, className, style }: BarChartProps) {
  const locale = useLocaleOf(localeProp);
  const fmt = yFormat ?? defaultFmt(locale), xFormat = xFormatProp ?? asIs;
  const [box, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const g = useRef<SVGGElement>(null);
  const [hidden, toggle] = useHidden(series);
  const [activeState, setActive] = useState<Active>(null);
  const active = within(activeState, data.length);
  /* a point the data no longer has is let go, so it does not come back when the data grows again */
  if (activeState !== null && active === null) setActive(null);
  const [kbd, setKbd] = useState(false);
  const shown = series.filter((s) => !hidden.has(s.key));
  /* NaN and ±Infinity are gaps, as in LineChart (one NaN made the peak NaN and the axis 0–1) */
  const num = (d: ChartDatum, k: string) => { const v = d[k]; return isNum(v) ? v : 0; };
  const peak = Math.max(0, extent(data.map((d) => (stacked ? shown.reduce((a, s) => a + Math.max(0, num(d, s.key)), 0) : Math.max(0, ...shown.map((s) => num(d, s.key))))))[1]);
  const ticks = niceTicks(0, peak || 1, Math.max(2, Math.round(height / 56)));
  const axis = useAxisLabels(ticks, locale, yFormat), tickFmt = axis.fmt;
  const top = ticks[ticks.length - 1];
  const leftTo = yAxisWidth(ticks.map(tickFmt)), ih = height - M.top - M.bottom;
  /* the scale's top and every bar (base and end per series × category, in data units) move as one (useMorph) */
  const ends: number[] = [];
  data.forEach((d) => {
    let acc = 0;
    series.forEach((s) => {
      const v = hidden.has(s.key) ? 0 : Math.max(0, num(d, s.key));
      if (stacked) { ends.push(acc, acc + v); acc += v; } else ends.push(0, v);
    });
  });
  /* where each series' bar sits across its category, as fractions (no pixels, so a resize still redraws at once):
     stacked, every series spans the whole bar; grouped, the shown series share it and a hidden one closes to nothing
     where it was. With "stackedness" they move with the heights, so switching layouts is one motion. */
  const slots: number[] = [];
  series.forEach((s) => {
    const before = shown.filter((o) => series.indexOf(o) < series.indexOf(s)).length;
    if (stacked) slots.push(0, 1);
    else slots.push(before / Math.max(1, shown.length), hidden.has(s.key) ? 0 : 1 / Math.max(1, shown.length));
  });
  const painter = useRef<Painter | null>(null);
  const morph = useMorph([top, ...ends, stacked ? 1 : 0, ...slots, leftTo], box, undefined, '', painter);
  const nAt = 1 + ends.length, slot0 = 2 + ends.length;
  /* how many categories share one label: as many as the plot's width leaves room for */
  const stepOf = (iw: number) => strideAt(iw, 64, data.length);
  /* everything that moves, for one sample of the move: React renders it, and the painter writes it on every frame of a
     move (#85). The gutter moves with the scale. */
  const geom = (now: number[], from: number[], p: number) => {
    const left = now[now.length - 1], iw = Math.max(10, width - left - M.right);
    const band = iw / Math.max(1, data.length), pad = Math.min(band * 0.28, 18);
    const sTop = now[0];
    const Y = (v: number) => M.top + ih - (v / (sTop || 1)) * ih;
    const grid = tickLayer(ticks, from[0] === top ? ticks : axis.outgoing(p), p).map(({ t, o }) => ({ t, o, y: Y(t) }));
    const nS = now[nAt], n = Math.max(1, shown.length);
    /* narrower bars than the band allows: a stack at most 40 px, a group's bars 22 px each */
    const wS = Math.min(band - pad, 40), wG = Math.min(band - pad, n * 22 + (n - 1) * 2);
    const inner = wG + (wS - wG) * nS;
    const gapX = shown.length > 1 ? 2 * (1 - nS) : 0;
    /* nothing is drawn until the width is known (the server, the first render) */
    const cols = (measured === null ? [] : data).map((_, i) => {
      const x0 = left + i * band + (band - inner) / 2;
      const segs = series.map((s, si) => {
        const at = (i * series.length + si) * 2;
        const base = now[1 + at], y = Y(now[2 + at]), h = Math.max(0, Y(base) - y);
        const st = now[slot0 + si * 2], sw = now[slot0 + si * 2 + 1];
        const w = Math.max(0, sw * inner - gapX);
        return { key: s.key, si, base, y, h, x: x0 + st * inner + gapX / 2, w, live: !hidden.has(s.key) || h > 0.5 || w > 0.5 };
      });
      const topY = Math.min(...segs.filter((q) => q.live && q.h > 0.5).map((q) => q.y), Y(0));
      return segs.map(({ key, si, base, y, h, x: bx, w, live }) => {
        const R = Math.min(6, w / 2.5);
        const onStack = base > (top || 1) * 1e-4;   /* something under it in the stack */
        /* top corners: a grouped bar rounds its own top; in a stack only the stack's top is round (a piece just under a
           shrinking top piece rounds in as it reaches the top, so a hidden series hands the roundness over without a
           jump) */
        const rt = R * (1 - nS) + Math.max(0, R - (y - topY)) * nS;
        /* a seam (2 px of the plot showing through) under every piece that sits on another, so the parts read apart
           without leaning on their colours alone, as the donut's slices */
        const gapY = onStack ? 2 * nS : 0;
        return { key, si, live, d: barPath(bx, y, w, h - Math.min(gapY, h), rt) };
      });
    });
    return { left, iw, band, base: Y(0), grid, step: stepOf(iw), cols };
  };
  const G = geom(morph.now, morph.from, morph.p), moving = morph.p < 1;
  const { left, iw, band } = G;
  /* while it moves, every label the moving gutter can make room for is mounted, and the painter shows the ones it does */
  const labelled = labelSteps(moving ? [Math.max(10, width - morph.from[morph.from.length - 1] - M.right), Math.max(10, width - leftTo - M.right), iw] : [iw], 64, data.length);
  const every = (i: number, k: number) => i % k === 0;
  /* the layout as last drawn: what a pointer is over (React's at rest, the painter's while it moves) */
  const geo = useRef(G);
  useIsoLayoutEffect(() => { geo.current = G; });
  const tipAt = (l: number, b: number) => l + (active ?? 0) * b + b / 2;
  /* draws a sample into what React mounted; false when it needs something that is not there (React renders instead) */
  const draw = (now: number[], from: number[], p: number): boolean => {
    const svg = box.current?.querySelector('svg');
    if (!svg) return true;
    const D = geom(now, from, p);
    geo.current = D;
    if (!paintGrid(svg, D.grid, D.left, D.iw)) return false;
    if (!paintLabels(svg, data.length, (i) => D.left + i * D.band + D.band / 2, (i) => every(i, D.step))) return false;
    const bars = new Map<string, Element>();
    for (const el of svg.querySelectorAll<SVGPathElement>('path[data-bar]')) bars.set(`${el.dataset.i}|${el.dataset.k}`, el);
    for (let i = 0; i < D.cols.length; i++) for (const q of D.cols[i]) {
      const el = bars.get(`${i}|${q.key}`);
      if (el) setAttrs(el, { d: q.d }); else if (q.live) return false;
    }
    setAttrs(svg.querySelector('[data-band]'), { x: D.left + (active ?? 0) * D.band, width: D.band });
    setAttrs(svg.querySelector('[data-axis]'), { x1: D.left, x2: D.left + D.iw });
    paintTip(box.current, tipAt(D.left, D.band), width);
    return true;
  };
  usePainter(painter, draw, morph.sample, moving);
  const tickLabel = axis.label;
  /* entrance: each category rises from the baseline as one bar (its pieces stay stacked), one after another */
  useIsoLayoutEffect(() => {
    const el = g.current;
    if (!el || measured === null) return;
    if (prefersReducedMotion(el)) { fade(el as unknown as HTMLElement, 0, 1, timing.appear); return; }
    el.querySelectorAll<SVGGElement>('g[data-col]').forEach((r) => {
      const i = +(r.dataset.i ?? 0);
      animate(r, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], 'bouncy', { delay: Math.min(i * 28, 300), fill: 'backwards' });
    });
  }, [measured !== null]);
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), at = geo.current;
    setKbd(false);
    setActive(data.length ? Math.max(0, Math.min(data.length - 1, Math.floor((e.clientX - r.left - at.left) / at.band))) : null);
  };
  const cell = (v: ChartDatum[string]) => (isNum(v) ? fmt(v) : '—');
  const rowsFor = (i: number) => shown.map((s) => ({ color: s.color ?? COLOR(series.indexOf(s)), label: s.label, value: cell(data[i][s.key]) }));
  const announce = kbd && active !== null ? `${xFormat(String(data[active][x]))}: ${rowsFor(active).map((r) => `${r.label} ${r.value}`).join(', ')}` : '';
  /* keyed on the formatters too: the defaults are kept at module level, but an app's inline one is new on every render */
  const table = useMemo(() => srTable(label, series.map((s) => s.label), data.map((d) => ({ head: xFormat(String(d[x])), cells: series.map((s) => cell(d[s.key])) }))), [label, series, data, x, xFormat, fmt]);
  return (
    <ChartChrome label={label} locale={locale} series={series} hidden={hidden} toggle={toggle} legend={legend} announce={announce} caption={caption} className={className} style={style}
      table={table}>
      <div ref={box} className="sg-chart__plot" tabIndex={0} role="img" aria-label={label}
        onPointerMove={onMove} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}
        onKeyDown={(e) => { setKbd(true); plotKeys(e, data.length, active, setActive); }}>
        {measured === null ? <div style={{ height }} /> : <svg width={width} height={height} aria-hidden="true">
          {active !== null && <rect data-band className="sg-chart__band" x={left + active * band} y={M.top} width={band} height={ih} rx={6} />}
          {G.grid.map(({ t, o, y }) => <g key={t} data-grid={t} opacity={o < 1 ? o.toFixed(3) : undefined}><line className="sg-chart__grid" x1={left} x2={left + iw} y1={y} y2={y} /><text className="sg-chart__tick" x={left - 8} y={y} dy="0.35em" textAnchor="end">{tickLabel(t)}</text></g>)}
          {data.map((d, i) => (labelled(i, every) ? <text key={i} data-xl={i} className="sg-chart__tick" x={left + i * band + band / 2} y={height - 6} textAnchor="middle" display={i % G.step === 0 ? undefined : 'none'}>{xFormat(String(d[x]))}</text> : null))}
          <g ref={g}>
            {G.cols.map((segs, i) => (
              <g key={i} data-col data-i={i} className="sg-chart__col">
                {/* a piece that has closed to nothing is let go once the move ends (while it moves, it stays for the painter) */}
                {segs.filter((q) => q.live || moving).map(({ key, si, d }) => <path key={key} data-bar data-i={i} data-k={key} className="sg-chart__bar" d={d} style={{ fill: series[si].color ?? COLOR(si) }} />)}
              </g>
            ))}
          </g>
          <line data-axis className="sg-chart__axis" x1={left} x2={left + iw} y1={G.base} y2={G.base} />
        </svg>}
        {active !== null && <Tip x={tipAt(left, band)} y={M.top + ih / 2} w={width} title={xFormat(String(data[active][x]))} rows={rowsFor(active)} />}
      </div>
    </ChartChrome>
  );
}

/* ------------------------------------------------------------------------------------------------ DonutChart */
export type DonutSlice = { label: string; value: number; color?: string };
export type DonutChartProps = {
  /** the slices, clockwise from the top; each one's share is its value over the total (negative values count as 0) */
  data: DonutSlice[];
  /** the ring's diameter in px */
  size?: number;
  /** the ring's width in px */
  thickness?: number;
  /** a line under the number in the middle (e.g. "Total"); an active slice's name takes its place */
  centerLabel?: ReactNode;
  /** the number in the middle (default: the total); an active slice's share takes its place */
  centerValue?: ReactNode;
  /** writes the values in the legend, the middle and what is read out (default: the locale's numbers, compact from
      10,000) */
  format?: Fmt;
  /** BCP 47 locale for the default number formats and the percentages (default: the ThemeProvider's
      `locale`, else 'en-US') */
  locale?: string;
  'aria-label': string;
  className?: string; style?: CSSProperties;
};

export function DonutChart({ data, size = 180, thickness = 22, centerLabel, centerValue, format, locale: localeProp, 'aria-label': label, className, style }: DonutChartProps) {
  const locale = useLocaleOf(localeProp);
  const fmt = format ?? defaultFmt(locale);
  /* a share counts only a finite value above 0 (a NaN poisoned every share); the total shown is the real one (an
     empty or all-zero donut said "1"), and only the division is guarded */
  const part = (d: DonutSlice) => (isNum(d.value) ? Math.max(0, d.value) : 0);
  const sum = data.reduce((a, d) => a + part(d), 0), total = sum || 1;
  const pct = nf(locale, { style: 'percent', maximumFractionDigits: 1 });
  const svg = useRef<SVGSVGElement>(null);
  const [activeState, setActive] = useState<Active>(null);
  /* nothing to share out: no slice is drawn, so none can be pointed at or stepped to */
  const active = sum === 0 ? null : within(activeState, data.length);
  /* a point the data no longer has is let go, so it does not come back when the data grows again */
  if (activeState !== null && active === null) setActive(null);
  const [kbd, setKbd] = useState(false);
  /* a mouse shows a slice while it is over it; a touch has no hover — a tap selects a slice and it stays until the
     same slice, or anything outside the chart, is tapped (otherwise the lift-off "leave" undid every tap at once) */
  const touch = useRef(false);
  const fig = useRef<HTMLElement>(null);
  const hover = (i: number | null) => (e: ReactPointerEvent) => { touch.current = e.pointerType === 'touch'; if (!touch.current) { setKbd(false); setActive(i); } };
  const tap = (i: number) => () => { if (touch.current) { setKbd(false); setActive((a) => (a === i ? null : i)); } };
  useEffect(() => {
    if (active === null || !touch.current) return;
    const away = (e: PointerEvent) => { if (!fig.current?.contains(e.target as Node)) setActive(null); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [active]);
  /* tween the cumulative angles */
  const ends: number[] = [];
  data.reduce((a, d) => { const e = a + (part(d) / total) * Math.PI * 2; ends.push(e); return e; }, 0);
  const painter = useRef<((now: number[]) => boolean | void) | null>(null);
  const tween = useTween(ends, svg, ends.map((v) => v.toFixed(4)).join(','), painter), ang = tween.now;
  useIsoLayoutEffect(() => {
    const el = svg.current?.querySelector<SVGGElement>('g[data-rings]');
    if (!el) return;
    if (prefersReducedMotion(el)) { fade(el as unknown as HTMLElement, 0, 1, timing.appear); return; }
    animate(el, [{ transform: 'rotate(-60deg) scale(0.86)', opacity: 0 }, { transform: 'none', opacity: 1 }], 'smooth', { fill: 'backwards' });
  }, []);
  const r = size / 2 - 6, ri = r - thickness, c = size / 2, gap = data.length > 1 ? 0.012 : 0;
  const arc = (a0: number, a1: number) => {
    if (a1 - a0 <= gap * 2) return '';
    const s = a0 + gap, e = a1 - gap;
    const p = (rad: number, a: number) => `${(c + Math.sin(a) * rad).toFixed(2)},${(c - Math.cos(a) * rad).toFixed(2)}`;
    const large = e - s > Math.PI ? 1 : 0;
    if (e - s >= Math.PI * 2 - 0.001) return `M${p(r, 0)}A${r},${r} 0 1 1 ${p(r, Math.PI)}A${r},${r} 0 1 1 ${p(r, 0)}M${p(ri, 0)}A${ri},${ri} 0 1 0 ${p(ri, Math.PI)}A${ri},${ri} 0 1 0 ${p(ri, 0)}Z`;
    return `M${p(r, s)}A${r},${r} 0 ${large} 1 ${p(r, e)}L${p(ri, e)}A${ri},${ri} 0 ${large} 0 ${p(ri, s)}Z`;
  };
  /* which slice is under the pointer, from where it is on the ring — not from the slice paths, which move when one
     lifts: a pointer resting on a slice's inner edge would otherwise be left behind by the lift, drop it, catch it
     again and set it bouncing forever. The band takes the lift and the gaps between slices in. */
  const at = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const b = e.currentTarget.getBoundingClientRect(), x = e.clientX - b.left - c, y = e.clientY - b.top - c, dist = Math.hypot(x, y);
    if (dist < ri - 2 || dist > r + 6) return null;
    const a = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
    const i = drawn.current.findIndex((end) => a < end);
    return i < 0 ? null : i;
  };
  /* the active slice lifts outward along its middle */
  const lift = (a0: number, a1: number) => { const m = (a0 + a1) / 2; return `translate(${(Math.sin(m) * 4).toFixed(2)}px, ${(-Math.cos(m) * 4).toFixed(2)}px)`; };
  /* the angles as last drawn: what a pointer is over (React's at rest, the painter's while it moves) */
  const drawn = useRef(ang);
  useIsoLayoutEffect(() => { drawn.current = ang; });
  /* draws the angles into the slices React mounted (one per datum, in order); false when they are not all there */
  const draw = (now: number[]): boolean => {
    const els = svg.current?.querySelectorAll<SVGPathElement>('path.sg-donut__slice');
    if (!els) return true;
    if (els.length !== now.length) return false;
    drawn.current = now;
    els.forEach((el, i) => {
      const a0 = i ? now[i - 1] : 0;
      setAttrs(el, { d: arc(a0, now[i]) });
      if (i === active) el.style.setProperty('--_lift', lift(a0, now[i]));
    });
    return true;
  };
  usePainter(painter, draw, () => [tween.sample()] as [number[]], tween.moving);
  const value = (d: DonutSlice) => (isNum(d.value) ? fmt(d.value) : '—');
  const say = (i: number) => `${data[i].label}: ${value(data[i])} (${pct.format(part(data[i]) / total)})`;
  return (
    <figure ref={fig} className={cx('sg-chart', 'sg-donut', className)} style={style} aria-label={label}>
      <div className="sg-donut__ring" tabIndex={0} role="img" aria-label={sum === 0 ? messagesFor(locale).chartEmpty(label) : label} style={{ width: size, height: size }}
        onKeyDown={(e) => { setKbd(true); plotKeys(e, data.length, active, setActive); }} onBlur={() => setActive(null)}
        onPointerMove={(e) => { touch.current = e.pointerType === 'touch'; if (!touch.current) { setKbd(false); setActive(at(e)); } }}
        onPointerLeave={hover(null)} onPointerDown={(e) => { touch.current = e.pointerType === 'touch'; }}
        onClick={(e) => { const i = at(e); if (touch.current && i !== null) tap(i)(); }}>
        <svg ref={svg} width={size} height={size} aria-hidden="true">
          {/* nothing to share out (no data, or every value 0): the ring's empty track, a groove as an empty rail is */}
          {sum === 0 && <circle className="sg-donut__track" cx={c} cy={c} r={r - thickness / 2} fill="none" strokeWidth={thickness} />}
          <g data-rings style={{ transformOrigin: 'center' }}>
            {data.map((d, i) => (
              /* the active slice lifts outward along its middle — a transform, so it moves on a spring instead of jumping */
              <path key={d.label} className="sg-donut__slice" d={arc(i ? ang[i - 1] : 0, ang[i])} data-active={active === i || undefined}
                style={{ fill: d.color ?? COLOR(i), opacity: active !== null && active !== i ? 0.45 : 1, ...(active === i ? { '--_lift': lift(i ? ang[i - 1] : 0, ang[i]) } as CSSProperties : {}) }} />
            ))}
          </g>
        </svg>
        <div className="sg-donut__center" aria-hidden="true">
          <div className="sg-donut__value">{active !== null ? pct.format(part(data[active]) / total) : centerValue ?? fmt(sum)}</div>
          <div className="sg-donut__label">{active !== null ? data[active].label : centerLabel}</div>
        </div>
      </div>
      <ul className="sg-donut__legend">
        {data.map((d, i) => (
          <li key={d.label} data-active={active === i || undefined} onPointerEnter={hover(i)} onPointerLeave={hover(null)} onPointerDown={(e) => { touch.current = e.pointerType === 'touch'; }} onClick={tap(i)}>
            <span className="sg-chart__swatch" style={{ background: d.color ?? COLOR(i) }} aria-hidden="true" />
            <span className="sg-donut__name">{d.label}</span><span className="sg-donut__num">{value(d)}</span><span className="sg-donut__pct">{pct.format(part(d) / total)}</span>
          </li>
        ))}
      </ul>
      <div className="sg-visually-hidden" aria-live="polite">{kbd && active !== null ? say(active) : ''}</div>
    </figure>
  );
}

/* ------------------------------------------------------------------------------------------------ Sparkline */
export type SparklineProps = {
  /** the points, oldest first; the line spans their range top to bottom and ends in a dot */
  values: number[];
  /** the line's colour */
  tone?: Tone;
  /** a soft fill under the line */
  area?: boolean;
  /** in px; the width follows the container */
  height?: number;
  /** decorative by default (the number next to it carries the meaning); give a label to expose it */
  'aria-label'?: string;
  className?: string; style?: CSSProperties;
};

export function Sparkline({ values, tone = 'accent', area = true, height = 32, 'aria-label': label, className, style }: SparklineProps) {
  const [box, measured] = useWidth<HTMLDivElement>(120);
  const width = measured ?? 0;
  const g = useRef<SVGGElement>(null);
  const gid = useStableId('sg-sp');
  const [lo, hi] = extent(values), pad = 3;
  const Y = (v: number) => pad + (height - pad * 2) * (1 - (v - lo) / (hi - lo || 1));
  const painter = useRef<((now: number[]) => boolean | void) | null>(null);
  const tween = useTween(values.map(Y), box, values.join(','), painter);
  const X = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const geom = (ys: number[]) => {
    const pts = ys.map((y, i) => [X(i), y] as [number, number]), line = pathOf(pts, true);
    return { pts, line, fill: `${line}L${X(values.length - 1)},${height}L${X(0)},${height}Z` };
  };
  const { pts, line, fill } = geom(tween.now);
  /* draws a sample of the move into what React mounted (#85) */
  const draw = (now: number[]) => {
    const svg = box.current?.querySelector('svg');
    if (!svg) return true;
    const D = geom(now), end = D.pts[D.pts.length - 1];
    setAttrs(svg.querySelector('[data-draw]'), { d: D.line });
    setAttrs(svg.querySelector('[data-fade]'), { d: D.fill });
    if (end) setAttrs(svg.querySelector('circle'), { cx: end[0], cy: end[1] });
    return true;
  };
  usePainter(painter, draw, () => [tween.sample()] as [number[]], tween.moving);
  useDrawIn(g, [measured !== null]);
  const color = tone === 'neutral' ? 'var(--sg-label-tertiary)' : tone === 'accent' ? 'var(--sg-accent)' : tone === 'info' ? 'var(--sg-info-text)' : `var(--sg-${tone})`;
  return (
    <div ref={box} className={cx('sg-sparkline', className)} style={{ height, color, ...style }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {measured !== null && <svg width={width} height={height}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0.2" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        <g ref={g}>
          {area && <path data-fade d={fill} fill={`url(#${gid})`} />}
          <path data-draw className="sg-sparkline__line" d={line} pathLength={1} />
        </g>
        {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill="currentColor" />}
      </svg>}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ in-cell marks */
export type BarMeterProps = {
  /** the amount the bar shows, between `min` and `max` (clamped) */
  value: number;
  /** the value of a full bar */
  max?: number;
  /** the value of an empty bar */
  min?: number;
  /** the bar's colour */
  tone?: Tone;
  /** the full bar's width in px */
  width?: number;
  className?: string; style?: CSSProperties;
};
/** A short bar for a table cell, next to the number it shows (decorative: the number is the content). */
export function BarMeter({ value, max = 100, min = 0, tone = 'neutral', width = 40, className, style }: BarMeterProps) {
  const p = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  return (
    <span className={cx('sg-barmeter', className)} data-tone={tone} style={{ width, ...style }} aria-hidden="true">
      <span className="sg-barmeter__fill" style={{ transform: `scaleX(${p.toFixed(4)})` }} />
    </span>
  );
}

export type IntervalPlotProps = {
  /** the estimate, drawn as a point */
  value: number;
  /** the interval's lower end (e.g. of a 95% confidence interval) */
  low?: number;
  /** the interval's upper end; the interval is drawn only with both `low` and `high` */
  high?: number;
  /** the axis's lower end */
  min?: number;
  /** the axis's upper end; values beyond the range are drawn at its ends */
  max?: number;
  /** a reference mark (e.g. chance level, a baseline) */
  reference?: number;
  /** the track's width in px */
  width?: number;
  /** the point's and interval's colour */
  tone?: 'accent' | 'neutral';
  'aria-label'?: string;
  className?: string; style?: CSSProperties;
};
/** A point and its interval on a thin track, with an optional reference tick — for estimates in table rows. */
export function IntervalPlot({ value, low, high, min = 0, max = 100, reference, width = 160, tone = 'neutral', 'aria-label': label, className, style }: IntervalPlotProps) {
  const P = (v: number) => `${(Math.max(0, Math.min(1, (v - min) / (max - min || 1))) * 100).toFixed(2)}%`;
  return (
    <span className={cx('sg-interval', className)} data-tone={tone} style={{ width, ...style }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className="sg-interval__track" />
      {reference !== undefined && <span className="sg-interval__ref" style={{ left: P(reference) }} />}
      {low !== undefined && high !== undefined && <span className="sg-interval__range" style={{ left: P(low), width: `calc(${P(high)} - ${P(low)})` }} />}
      <span className="sg-interval__dot" style={{ left: P(value) }} />
    </span>
  );
}
