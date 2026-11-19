/* Charts (0.3): own SVG charts for dashboards — line / area, bar (grouped, stacked), donut, sparkline — and the
   small marks that live inside table cells (BarMeter, IntervalPlot).
   Every chart: series colours from the theme (--sg-chart-1…6, ≥ 3:1 on the card), a legend that hides and shows
   series, a crosshair tooltip that follows the pointer or the arrow keys (the plot is focusable and announces the
   point), and the full data as a hidden table for screen readers. Motion is the library's: entrances draw in on
   the named springs (bars rise on 'bouncy', the donut turns in on 'smooth', lines draw on a non-overshooting
   'gentle'), so they follow the motion personality; new data moves there on a spring per value that keeps its
   velocity when the data changes again mid-way. With reduced motion a chart fades in (140 ms) and data changes
   land at once. */
import { startTransition, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Spring, animate, fade, loop, motionFor, prefersReducedMotion } from '@satin-glass/core';
import { cx, useIsoLayoutEffect, useStableId, type Tone } from './utils';

/* ------------------------------------------------------------------------------------------------ shared */
export type ChartSeries = { key: string; label: string; color?: string };
export type ChartDatum = Record<string, string | number | null | undefined>;
type Fmt = (v: number) => string;

const COLOR = (i: number) => `var(--sg-chart-${(i % 6) + 1})`;
/* Intl formatters are costly to build: one per locale and options, shared by every chart */
const formatters = new Map<string, Intl.NumberFormat>();
const nf = (locale: string | undefined, opts: Intl.NumberFormatOptions) => {
  const k = `${locale ?? ''}|${JSON.stringify(opts)}`;
  let f = formatters.get(k);
  if (!f) { f = new Intl.NumberFormat(locale, opts); formatters.set(k, f); }
  return f;
};
const fmts = new Map<string, Fmt>();
const defaultFmt = (locale?: string): Fmt => {
  let fn = fmts.get(locale ?? '');
  if (!fn) {
    const f = nf(locale, { maximumFractionDigits: 1 }), c = nf(locale, { notation: 'compact', maximumFractionDigits: 1 });
    fn = (v) => (Math.abs(v) >= 10000 ? c.format(v) : f.format(v));
    fmts.set(locale ?? '', fn);
  }
  return fn;
};

/** "Nice" axis: rounds the domain out to 1 / 2 / 2.5 / 5 × 10ⁿ steps. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max)) return [0, 1];
  if (min === max) { const d = Math.abs(min) || 1; min -= d / 2; max += d / 2; }
  const raw = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}

/** The width a chart lays out to. Read from a ResizeObserver — after the browser's own layout, never by forcing
    one (reading clientWidth while a whole dashboard mounts made every chart pay for a synchronous page layout).
    Until it is known (one frame) the chart holds its height with an empty box; the drawing then renders as a
    transition, in slices. */
function useWidth<T extends HTMLElement>(fallback = 480) {
  const ref = useRef<T>(null);
  const [w, setW] = useState<number | null>(() => (typeof ResizeObserver === 'undefined' ? fallback : null));
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { const v = Math.round(e.contentRect.width) || fallback; startTransition(() => setW(v)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Move numbers from the previous render to these on a spring each ('smooth' of the motion personality), keeping
    their velocity if the target changes again mid-way. At once the first time and with reduced motion. */
function useTween(target: number[], el: React.RefObject<Element | null>, key: string): number[] {
  const [shown, setShown] = useState(target);
  const springs = useRef<Spring[] | null>(null), stop = useRef<(() => void) | null>(null);
  useIsoLayoutEffect(() => {
    const b = target, cur = springs.current;
    if (!cur || cur.length !== b.length || prefersReducedMotion(el.current)) {
      stop.current?.(); stop.current = null;
      springs.current = b.map((v) => new Spring(v, 'smooth', el.current));
      setShown(b);
      return;
    }
    if (cur.every((sp, i) => sp.target === b[i])) return;
    cur.forEach((sp, i) => { sp.set('smooth', el.current); sp.target = b[i]; });
    if (stop.current) return;   /* already running: it simply heads for the new targets */
    stop.current = loop((dt) => {
      let moving = false;
      for (const sp of cur) { sp.step(dt); if (sp.settled) sp.jump(sp.target); else moving = true; }
      setShown(cur.map((sp) => sp.value));
      if (!moving) stop.current = null;
      return moving;
    });
  }, [key]);
  useEffect(() => () => { stop.current?.(); }, []);
  return shown;
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
    if (prefersReducedMotion(g)) { fade(g as unknown as HTMLElement, 0, 1, 140); return; }
    /* the pace of the personality's 'gentle', never overshooting (a stroke drawn past its end would leave a gap) */
    const draw = { response: motionFor(g).gentle.response, damping: 1 };
    g.querySelectorAll<SVGPathElement>('[data-draw]').forEach((p, i) => { animate(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], draw, { delay: i * 60, fill: 'backwards' }); });
    g.querySelectorAll<SVGElement>('[data-fade]').forEach((p) => { animate(p, [{ opacity: 0 }, { opacity: 1 }], 'gentle', { delay: 200, fill: 'backwards' }); });
  }, deps);
}

type Active = number | null;
type ChartChromeProps = {
  label: string; series: ChartSeries[]; hidden: Set<string>; toggle: (k: string) => void; legend: boolean;
  rows: { head: string; cells: string[] }[]; announce: string; children: ReactNode; className?: string; style?: CSSProperties; caption?: ReactNode;
  legendLabel?: string;
};
function ChartChrome({ label, series, hidden, toggle, legend, rows, announce, children, className, style, caption }: ChartChromeProps) {
  return (
    <figure className={cx('sg-chart', className)} style={style} aria-label={label}>
      {legend && series.length > 1 && (
        <div className="sg-chart__legend" role="group" aria-label={`${label} — series`}>
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
      <table className="sg-visually-hidden">
        <caption>{label}</caption>
        <thead><tr><th scope="col">{rows.length ? '' : ''}</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><th scope="row">{r.head}</th>{r.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
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
  let n: number | null | undefined;
  if (k === 'ArrowRight' || k === 'ArrowDown') n = active === null ? 0 : Math.min(count - 1, active + 1);
  else if (k === 'ArrowLeft' || k === 'ArrowUp') n = active === null ? count - 1 : Math.max(0, active - 1);
  else if (k === 'Home') n = 0;
  else if (k === 'End') n = count - 1;
  else if (k === 'Escape') n = null;
  if (n === undefined) return;
  e.preventDefault();
  set(n);
}

type TipRow = { color: string; label: string; value: string };
function Tip({ x, y, w, title, rows }: { x: number; y: number; w: number; title: string; rows: TipRow[] }) {
  const right = x > w * 0.6;
  return (
    <div className="sg-chart__tip" aria-hidden="true" style={{ left: x, top: y, transform: `translate(${right ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}>
      <div className="sg-chart__tip-title">{title}</div>
      {rows.map((r) => <div key={r.label} className="sg-chart__tip-row"><span className="sg-chart__swatch" style={{ background: r.color }} />{r.label}<b>{r.value}</b></div>)}
    </div>
  );
}

const M = { top: 10, right: 12, bottom: 26 };
const yAxisWidth = (labels: string[]) => Math.max(28, Math.max(...labels.map((l) => l.length)) * 7 + 10);

/* ------------------------------------------------------------------------------------------------ LineChart */
export type LineChartProps = {
  data: ChartDatum[];
  /** key of the x label in each datum */
  x: string;
  series: ChartSeries[];
  /** fill under the lines */
  area?: boolean;
  curve?: 'smooth' | 'linear';
  /** start the y axis at zero (default: for areas) */
  zero?: boolean;
  height?: number;
  yFormat?: Fmt;
  xFormat?: (v: string) => string;
  legend?: boolean;
  locale?: string;
  'aria-label': string;
  caption?: ReactNode;
  className?: string; style?: CSSProperties;
};

export function LineChart({ data, x, series, area, curve = 'smooth', zero, height = 240, yFormat, xFormat = (v) => v, legend = true, locale, 'aria-label': label, caption, className, style }: LineChartProps) {
  const fmt = yFormat ?? defaultFmt(locale);
  const [box, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const g = useRef<SVGGElement>(null);
  const [hidden, toggle] = useHidden(series);
  const [active, setActive] = useState<Active>(null);
  const [kbd, setKbd] = useState(false);
  const gid = useStableId('sg-lc');
  const shown = series.filter((s) => !hidden.has(s.key));
  const vals = shown.flatMap((s) => data.map((d) => d[s.key]).filter((v): v is number => typeof v === 'number'));
  const lo = Math.min(...vals, zero ?? area ? 0 : Infinity), hi = Math.max(...vals);
  const ticks = niceTicks(lo, hi, Math.max(2, Math.round(height / 56)));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const left = yAxisWidth(ticks.map(fmt));
  const iw = Math.max(10, width - left - M.right), ih = height - M.top - M.bottom;
  const X = (i: number) => left + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const Y = (v: number) => M.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  /* tween the drawn y positions (per series × point), keyed on the data and what is visible */
  const target = series.flatMap((s) => data.map((d) => (typeof d[s.key] === 'number' ? Y(d[s.key] as number) : Y(y0))));
  const ys = useTween(target, box, target.map((v) => v.toFixed(1)).join(','));
  useDrawIn(g, [measured !== null]);
  const step = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(iw / 72))));
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    setKbd(false);
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(((px - left) / iw) * (data.length - 1)))));
  };
  const rowsFor = (i: number) => shown.map((s) => ({ color: s.color ?? COLOR(series.indexOf(s)), label: s.label, value: typeof data[i][s.key] === 'number' ? fmt(data[i][s.key] as number) : '—' }));
  const announce = kbd && active !== null ? `${xFormat(String(data[active][x]))}: ${rowsFor(active).map((r) => `${r.label} ${r.value}`).join(', ')}` : '';
  return (
    <ChartChrome label={label} series={series} hidden={hidden} toggle={toggle} legend={legend} announce={announce} caption={caption} className={className} style={style}
      rows={data.map((d) => ({ head: xFormat(String(d[x])), cells: series.map((s) => (typeof d[s.key] === 'number' ? fmt(d[s.key] as number) : '—')) }))}>
      <div ref={box} className="sg-chart__plot" tabIndex={0} role="img" aria-label={label}
        onPointerMove={onMove} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}
        onKeyDown={(e) => { setKbd(true); plotKeys(e, data.length, active, setActive); }}>
        {measured === null ? <div style={{ height }} /> : <svg width={width} height={height} aria-hidden="true">
          <defs>{series.map((s, i) => (
            <linearGradient key={s.key} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color ?? COLOR(i)} stopOpacity="0.22" /><stop offset="1" stopColor={s.color ?? COLOR(i)} stopOpacity="0" /></linearGradient>
          ))}</defs>
          {ticks.map((t) => <g key={t}><line className="sg-chart__grid" x1={left} x2={left + iw} y1={Y(t)} y2={Y(t)} /><text className="sg-chart__tick" x={left - 8} y={Y(t)} dy="0.35em" textAnchor="end">{fmt(t)}</text></g>)}
          {/* every step-th label, plus the last one when it does not crowd its neighbour */}
          {data.map((d, i) => (i % step === 0 || (i === data.length - 1 && i % step >= step / 2)) ? (
            <text key={i} className="sg-chart__tick" x={X(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>{xFormat(String(d[x]))}</text>
          ) : null)}
          <g ref={g}>
            {series.map((s, si) => {
              if (hidden.has(s.key)) return null;
              const pts = data.map((_, i) => [X(i), ys[si * data.length + i] ?? Y(y0)] as [number, number]);
              const line = pathOf(pts, curve === 'smooth');
              return (
                <g key={s.key} style={{ color: s.color ?? COLOR(si) }}>
                  {area && <path data-fade d={`${line}L${X(data.length - 1)},${Y(Math.max(y0, 0))}L${X(0)},${Y(Math.max(y0, 0))}Z`} fill={`url(#${gid}-${si})`} />}
                  <path data-draw className="sg-chart__line" d={line} pathLength={1} />
                </g>
              );
            })}
          </g>
          {active !== null && (
            <g className="sg-chart__cross">
              <line x1={X(active)} x2={X(active)} y1={M.top} y2={M.top + ih} />
              {shown.map((s) => { const si = series.indexOf(s); const v = data[active][s.key]; return typeof v === 'number' ? <circle key={s.key} cx={X(active)} cy={Y(v)} r={4} style={{ fill: s.color ?? COLOR(si) }} /> : null; })}
            </g>
          )}
        </svg>}
        {active !== null && <Tip x={X(active)} y={M.top + ih / 2} w={width} title={xFormat(String(data[active][x]))} rows={rowsFor(active)} />}
      </div>
    </ChartChrome>
  );
}

/* ------------------------------------------------------------------------------------------------ BarChart */
export type BarChartProps = Omit<LineChartProps, 'area' | 'curve' | 'zero'> & { stacked?: boolean };

export function BarChart({ data, x, series, stacked, height = 240, yFormat, xFormat = (v) => v, legend = true, locale, 'aria-label': label, caption, className, style }: BarChartProps) {
  const fmt = yFormat ?? defaultFmt(locale);
  const [box, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const g = useRef<SVGGElement>(null);
  const [hidden, toggle] = useHidden(series);
  const [active, setActive] = useState<Active>(null);
  const [kbd, setKbd] = useState(false);
  const shown = series.filter((s) => !hidden.has(s.key));
  const num = (d: ChartDatum, k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0);
  const peak = Math.max(0, ...data.map((d) => (stacked ? shown.reduce((a, s) => a + Math.max(0, num(d, s.key)), 0) : Math.max(0, ...shown.map((s) => num(d, s.key))))));
  const ticks = niceTicks(0, peak || 1, Math.max(2, Math.round(height / 56)));
  const top = ticks[ticks.length - 1];
  const left = yAxisWidth(ticks.map(fmt));
  const iw = Math.max(10, width - left - M.right), ih = height - M.top - M.bottom;
  const band = iw / Math.max(1, data.length), pad = Math.min(band * 0.28, 18);
  const inner = band - pad;
  const Y = (v: number) => M.top + ih - (v / (top || 1)) * ih;
  /* bar geometry, tweened (y, height per series × category) */
  const geom: number[] = [];
  data.forEach((d) => {
    let acc = 0;
    series.forEach((s) => {
      const v = hidden.has(s.key) ? 0 : Math.max(0, num(d, s.key));
      if (stacked) { geom.push(Y(acc + v), Y(acc) - Y(acc + v)); acc += v; }
      else geom.push(Y(v), Y(0) - Y(v));
    });
  });
  const gv = useTween(geom, box, geom.map((v) => v.toFixed(1)).join(','));
  /* entrance: bars rise from the baseline, one category after another */
  useIsoLayoutEffect(() => {
    const el = g.current;
    if (!el || measured === null) return;
    if (prefersReducedMotion(el)) { fade(el as unknown as HTMLElement, 0, 1, 140); return; }
    el.querySelectorAll<SVGRectElement>('rect[data-bar]').forEach((r) => {
      const i = +(r.dataset.i ?? 0);
      animate(r, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], 'bouncy', { delay: Math.min(i * 28, 300), fill: 'backwards' });
    });
  }, [measured !== null]);
  const groupW = stacked ? inner : inner / Math.max(1, shown.length);
  const k = (s: ChartSeries) => shown.indexOf(s);
  const step = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(iw / 64))));
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setKbd(false);
    setActive(Math.max(0, Math.min(data.length - 1, Math.floor((e.clientX - r.left - left) / band))));
  };
  const rowsFor = (i: number) => shown.map((s) => ({ color: s.color ?? COLOR(series.indexOf(s)), label: s.label, value: typeof data[i][s.key] === 'number' ? fmt(data[i][s.key] as number) : '—' }));
  const announce = kbd && active !== null ? `${xFormat(String(data[active][x]))}: ${rowsFor(active).map((r) => `${r.label} ${r.value}`).join(', ')}` : '';
  return (
    <ChartChrome label={label} series={series} hidden={hidden} toggle={toggle} legend={legend} announce={announce} caption={caption} className={className} style={style}
      rows={data.map((d) => ({ head: xFormat(String(d[x])), cells: series.map((s) => (typeof d[s.key] === 'number' ? fmt(d[s.key] as number) : '—')) }))}>
      <div ref={box} className="sg-chart__plot" tabIndex={0} role="img" aria-label={label}
        onPointerMove={onMove} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}
        onKeyDown={(e) => { setKbd(true); plotKeys(e, data.length, active, setActive); }}>
        {measured === null ? <div style={{ height }} /> : <svg width={width} height={height} aria-hidden="true">
          {active !== null && <rect className="sg-chart__band" x={left + active * band} y={M.top} width={band} height={ih} rx={6} />}
          {ticks.map((t) => <g key={t}><line className="sg-chart__grid" x1={left} x2={left + iw} y1={Y(t)} y2={Y(t)} /><text className="sg-chart__tick" x={left - 8} y={Y(t)} dy="0.35em" textAnchor="end">{fmt(t)}</text></g>)}
          {data.map((d, i) => (i % step === 0 ? <text key={i} className="sg-chart__tick" x={left + i * band + band / 2} y={height - 6} textAnchor="middle">{xFormat(String(d[x]))}</text> : null))}
          <g ref={g}>
            {data.map((_, i) => series.map((s, si) => {
              if (hidden.has(s.key)) return null;
              const at = (i * series.length + si) * 2;
              const y = gv[at] ?? Y(0), h = Math.max(0, gv[at + 1] ?? 0);
              const bx = left + i * band + pad / 2 + (stacked ? 0 : k(s) * groupW);
              const w = Math.max(1, groupW - (stacked || shown.length === 1 ? 0 : 2));
              return <rect key={`${i}-${s.key}`} data-bar data-i={i} className="sg-chart__bar" x={bx} y={y} width={w} height={h} rx={Math.min(4, w / 2)} style={{ fill: s.color ?? COLOR(si) }} />;
            }))}
          </g>
          <line className="sg-chart__axis" x1={left} x2={left + iw} y1={Y(0)} y2={Y(0)} />
        </svg>}
        {active !== null && <Tip x={left + active * band + band / 2} y={M.top + ih / 2} w={width} title={xFormat(String(data[active][x]))} rows={rowsFor(active)} />}
      </div>
    </ChartChrome>
  );
}

/* ------------------------------------------------------------------------------------------------ DonutChart */
export type DonutSlice = { label: string; value: number; color?: string };
export type DonutChartProps = {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  /** in the middle (defaults to the total) */
  centerLabel?: ReactNode;
  centerValue?: ReactNode;
  format?: Fmt;
  locale?: string;
  'aria-label': string;
  className?: string; style?: CSSProperties;
};

export function DonutChart({ data, size = 180, thickness = 22, centerLabel, centerValue, format, locale, 'aria-label': label, className, style }: DonutChartProps) {
  const fmt = format ?? defaultFmt(locale);
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
  const pct = nf(locale, { style: 'percent', maximumFractionDigits: 1 });
  const svg = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<Active>(null);
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
  data.reduce((a, d) => { const e = a + (Math.max(0, d.value) / total) * Math.PI * 2; ends.push(e); return e; }, 0);
  const ang = useTween(ends, svg, ends.map((v) => v.toFixed(4)).join(','));
  useIsoLayoutEffect(() => {
    const el = svg.current?.querySelector<SVGGElement>('g[data-rings]');
    if (!el) return;
    if (prefersReducedMotion(el)) { fade(el as unknown as HTMLElement, 0, 1, 140); return; }
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
    const i = ang.findIndex((end) => a < end);
    return i < 0 ? null : i;
  };
  const say = (i: number) => `${data[i].label}: ${fmt(data[i].value)} (${pct.format(data[i].value / total)})`;
  return (
    <figure ref={fig} className={cx('sg-chart', 'sg-donut', className)} style={style} aria-label={label}>
      <div className="sg-donut__ring" tabIndex={0} role="img" aria-label={label} style={{ width: size, height: size }}
        onKeyDown={(e) => { setKbd(true); plotKeys(e, data.length, active, setActive); }} onBlur={() => setActive(null)}
        onPointerMove={(e) => { touch.current = e.pointerType === 'touch'; if (!touch.current) { setKbd(false); setActive(at(e)); } }}
        onPointerLeave={hover(null)} onPointerDown={(e) => { touch.current = e.pointerType === 'touch'; }}
        onClick={(e) => { const i = at(e); if (touch.current && i !== null) tap(i)(); }}>
        <svg ref={svg} width={size} height={size} aria-hidden="true">
          <g data-rings style={{ transformOrigin: 'center' }}>
            {data.map((d, i) => (
              /* the active slice lifts outward along its middle — a transform, so it moves on a spring instead of jumping */
              <path key={d.label} className="sg-donut__slice" d={arc(i ? ang[i - 1] : 0, ang[i])} data-active={active === i || undefined}
                style={{ fill: d.color ?? COLOR(i), opacity: active !== null && active !== i ? 0.45 : 1, transform: active === i ? (() => { const m = ((i ? ang[i - 1] : 0) + ang[i]) / 2; return `translate(${(Math.sin(m) * 4).toFixed(2)}px, ${(-Math.cos(m) * 4).toFixed(2)}px)`; })() : undefined }} />
            ))}
          </g>
        </svg>
        <div className="sg-donut__center" aria-hidden="true">
          <div className="sg-donut__value">{active !== null ? pct.format(data[active].value / total) : centerValue ?? fmt(total)}</div>
          <div className="sg-donut__label">{active !== null ? data[active].label : centerLabel}</div>
        </div>
      </div>
      <ul className="sg-donut__legend">
        {data.map((d, i) => (
          <li key={d.label} data-active={active === i || undefined} onPointerEnter={hover(i)} onPointerLeave={hover(null)} onPointerDown={(e) => { touch.current = e.pointerType === 'touch'; }} onClick={tap(i)}>
            <span className="sg-chart__swatch" style={{ background: d.color ?? COLOR(i) }} aria-hidden="true" />
            <span className="sg-donut__name">{d.label}</span><span className="sg-donut__num">{fmt(d.value)}</span><span className="sg-donut__pct">{pct.format(d.value / total)}</span>
          </li>
        ))}
      </ul>
      <div className="sg-visually-hidden" aria-live="polite">{kbd && active !== null ? say(active) : ''}</div>
    </figure>
  );
}

/* ------------------------------------------------------------------------------------------------ Sparkline */
export type SparklineProps = {
  values: number[];
  tone?: Tone;
  area?: boolean;
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
  const lo = Math.min(...values), hi = Math.max(...values), pad = 3;
  const Y = (v: number) => pad + (height - pad * 2) * (1 - (v - lo) / (hi - lo || 1));
  const ys = useTween(values.map(Y), box, values.join(','));
  const X = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const pts = ys.map((y, i) => [X(i), y] as [number, number]);
  const line = pathOf(pts, true);
  useDrawIn(g, [measured !== null]);
  const color = tone === 'neutral' ? 'var(--sg-label-tertiary)' : tone === 'accent' ? 'var(--sg-accent)' : tone === 'info' ? 'var(--sg-info-text)' : `var(--sg-${tone})`;
  return (
    <div ref={box} className={cx('sg-sparkline', className)} style={{ height, color, ...style }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {measured !== null && <svg width={width} height={height}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0.2" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        <g ref={g}>
          {area && <path data-fade d={`${line}L${X(values.length - 1)},${height}L${X(0)},${height}Z`} fill={`url(#${gid})`} />}
          <path data-draw className="sg-sparkline__line" d={line} pathLength={1} />
        </g>
        {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill="currentColor" />}
      </svg>}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ in-cell marks */
export type BarMeterProps = {
  value: number; max?: number; min?: number;
  tone?: Tone;
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
  value: number;
  /** interval (e.g. 95 % confidence) */
  low?: number; high?: number;
  /** axis range */
  min?: number; max?: number;
  /** a reference mark (e.g. chance level, a baseline) */
  reference?: number;
  width?: number;
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
