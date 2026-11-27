/* Data the components must survive: empty and shrinking data, non-finite values, huge or sparse series, large
   selections, dates, and the viewer's index and items changing under it. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Activity, Suspense, startTransition, useState, type ReactElement } from 'react';
import { niceTicks, LineChart, BarChart, DonutChart, ScatterChart, Sparkline, DataTable, MediaViewer, ThemeProvider, createTheme, type Column, type MediaItem } from '../src';

/* a ResizeObserver that reports a 400 px wide box at once (charts draw only once they know their width) and
   keeps its callbacks so a test can fire them again */
const observers: (() => void)[] = [];
const RealRO = (globalThis as any).ResizeObserver;
beforeEach(() => {
  observers.length = 0;
  (globalThis as any).ResizeObserver = class {
    cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this.cb = cb; }
    observe() { const fire = () => this.cb([{ contentRect: { width: 400, height: 300 } } as any], this as any); observers.push(fire); fire(); }
    unobserve() {} disconnect() {}
  };
});
afterEach(() => { (globalThis as any).ResizeObserver = RealRO; vi.restoreAllMocks(); });

describe('niceTicks', () => {
  it('ends on a large, narrow domain (step below the float resolution)', () => {
    const t = niceTicks(1e16, 1e16 + 2);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t.length).toBeLessThan(10);
    expect(t[0]).toBeLessThanOrEqual(1e16);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(1e16 + 2);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
  });
  it('keeps the ticks of a tiny domain, at the step\'s precision', () => {
    expect(niceTicks(1e-12, 9e-12)).toEqual([0, 2e-12, 4e-12, 6e-12, 8e-12, 1e-11]);
    expect(niceTicks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
    expect(niceTicks(0, 97, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });
  it('stays finite and bounded at the ends of the number line', () => {
    const covers = (t: number[], lo: number, hi: number) => {
      expect(t.length).toBeGreaterThan(0);
      expect(t.every(Number.isFinite)).toBe(true);
      expect(t[0]).toBeLessThanOrEqual(lo);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(hi);
    };
    covers(niceTicks(-1e308, 1e308), -1e308, 1e308);
    covers(niceTicks(-1e308, 1e308, 1), -1e308, 1e308);
    covers(niceTicks(0, Number.MAX_VALUE), 0, Number.MAX_VALUE);
    covers(niceTicks(1.5e308, 1.5e308), 1.5e308, 1.5e308);
    covers(niceTicks(-Number.MAX_VALUE, -Number.MAX_VALUE), -Number.MAX_VALUE, -Number.MAX_VALUE);
    expect(niceTicks(-1e308, 1e308).length).toBeLessThan(20);
    expect(niceTicks(5, 1)[0]).toBeLessThanOrEqual(1);
  });
  it('never collapses to one tick when both ends divide onto the same index', () => {
    const t = niceTicks(0.31, 0.31000000000000005);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t[0]).toBeLessThanOrEqual(0.31);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(0.31000000000000005);
    expect(t[t.length - 1]).toBeGreaterThan(t[0]);
  });
  it('widens the step rather than cut the domain short when asked for too many ticks', () => {
    for (const [lo, hi] of [[1, 10], [0, 2000]]) {
      const t = niceTicks(lo, hi, 2000);
      expect(t.length).toBeLessThanOrEqual(1001);
      expect(t[0]).toBeLessThanOrEqual(lo);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(hi);
    }
  });
});

describe('charts: the active point', () => {
  const series = [{ key: 'v', label: 'Value' }];
  const plot = (c: HTMLElement) => c.querySelector<HTMLElement>('.sg-chart__plot, .sg-donut__ring')!;
  it('line and bar charts without data ignore the pointer and the keys', () => {
    for (const Chart of [LineChart, BarChart]) {
      const { container, unmount } = render(<Chart aria-label="c" data={[]} x="x" series={series} />);
      fireEvent.pointerMove(plot(container), { clientX: 100, clientY: 50 });
      fireEvent.keyDown(plot(container), { key: 'ArrowRight' });
      fireEvent.keyDown(plot(container), { key: 'End' });
      expect(container.querySelector('.sg-chart__tip')).toBeNull();
      unmount();
    }
  });
  it('line and bar charts drop a point the data no longer has', () => {
    for (const Chart of [LineChart, BarChart]) {
      const data = [{ x: 'a', v: 1 }, { x: 'b', v: 2 }, { x: 'c', v: 3 }];
      const { container, rerender, unmount } = render(<Chart aria-label="c" data={data} x="x" series={series} />);
      fireEvent.keyDown(plot(container), { key: 'End' });
      expect(container.querySelector('.sg-chart__tip-title')!.textContent).toBe('c');
      rerender(<Chart aria-label="c" data={data.slice(0, 1)} x="x" series={series} />);
      expect(container.querySelector('.sg-chart__tip')).toBeNull();
      fireEvent.keyDown(plot(container), { key: 'ArrowRight' });
      expect(container.querySelector('.sg-chart__tip-title')!.textContent).toBe('a');
      rerender(<Chart aria-label="c" data={[]} x="x" series={series} />);
      expect(container.querySelector('.sg-chart__tip')).toBeNull();
      unmount();
    }
  });
  it('a point let go does not come back when the data grows again', () => {
    const data = [{ x: 'a', v: 1 }, { x: 'b', v: 2 }, { x: 'c', v: 3 }];
    for (const Chart of [LineChart, BarChart]) {
      for (const between of [[], data.slice(0, 1)]) {
        const { container, rerender, unmount } = render(<Chart aria-label="c" data={data} x="x" series={series} />);
        fireEvent.keyDown(plot(container), { key: 'End' });
        rerender(<Chart aria-label="c" data={between} x="x" series={series} />);
        rerender(<Chart aria-label="c" data={data} x="x" series={series} />);
        expect(container.querySelector('.sg-chart__tip')).toBeNull();
        expect(container.querySelector('[aria-live]')!.textContent).toBe('');
        unmount();
      }
    }
    const slices = [{ label: 'a', value: 1 }, { label: 'b', value: 2 }, { label: 'c', value: 3 }];
    const d = render(<DonutChart aria-label="d" data={slices} />);
    fireEvent.keyDown(plot(d.container), { key: 'End' });
    d.rerender(<DonutChart aria-label="d" data={[]} />);
    d.rerender(<DonutChart aria-label="d" data={slices} />);
    expect(d.container.querySelector('.sg-donut__slice[data-active]')).toBeNull();
    d.unmount();
    const pts = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 2, b: 2 }];
    const s = render(<ScatterChart aria-label="s" data={pts} x="a" y="b" pointLabel="n" />);
    fireEvent.keyDown(plot(s.container), { key: 'End' });
    s.rerender(<ScatterChart aria-label="s" data={pts.slice(0, 1)} x="a" y="b" pointLabel="n" />);
    s.rerender(<ScatterChart aria-label="s" data={pts} x="a" y="b" pointLabel="n" />);
    expect(s.container.querySelector('.sg-chart__tip')).toBeNull();
  });
  it('a donut without data, or with fewer slices, keeps no active slice', () => {
    const { container, rerender } = render(<DonutChart aria-label="d" data={[]} />);
    fireEvent.keyDown(plot(container), { key: 'ArrowRight' });
    fireEvent.keyDown(plot(container), { key: 'ArrowLeft' });
    expect(container.querySelector('.sg-donut__slice[data-active]')).toBeNull();
    rerender(<DonutChart aria-label="d" data={[{ label: 'a', value: 1 }, { label: 'b', value: 3 }]} />);
    fireEvent.keyDown(plot(container), { key: 'End' });
    expect(container.querySelector('.sg-donut__label')!.textContent).toBe('b');
    rerender(<DonutChart aria-label="d" data={[{ label: 'a', value: 1 }]} />);
    expect(container.querySelector('.sg-donut__slice[data-active]')).toBeNull();
    expect(container.querySelector('.sg-donut__value')!.textContent).toBe('1');
  });
  it('a scatter chart drops a point that is no longer plotted', () => {
    const data = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 2, b: 2 }];
    const { container, rerender } = render(<ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" />);
    fireEvent.keyDown(plot(container), { key: 'End' });
    expect(container.querySelector('.sg-chart__tip-title')!.textContent).toBe('q');
    rerender(<ScatterChart aria-label="s" data={data.slice(0, 1)} x="a" y="b" pointLabel="n" />);
    expect(container.querySelector('.sg-chart__tip')).toBeNull();
    rerender(<ScatterChart aria-label="s" data={[data[0], { n: 'q', a: null, b: 2 }]} x="a" y="b" pointLabel="n" />);
    expect(container.querySelector('.sg-chart__tip')).toBeNull();
  });
});

describe('charts: a scatter chart keeps the scale history of what it showed (#83)', () => {
  /* a render React starts and throws away (here a transition to a log axis that suspends) must not count as shown: the
     next real change, linear to linear, moves each point from where it was, not as if the axis had switched */
  it('a change after a discarded switch to log starts every point where it was drawn', async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    {
      const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
      const B = [{ n: 'p', a: 2, b: 1 }, { n: 'q', a: 20, b: 2 }, { n: 'r', a: 200, b: 3 }];
      const never = new Promise<void>(() => {});
      let tried = 0;
      function Gate({ on }: { on: boolean }) { if (on) { tried++; throw never; } return null; }
      let setS: (v: { scale: 'linear' | 'log'; data: typeof A }) => void = () => {};
      function Host() {
        const [st, set] = useState<{ scale: 'linear' | 'log'; data: typeof A }>({ scale: 'linear', data: A }); setS = set;
        return <Suspense fallback={null}><ScatterChart aria-label="s" data={st.data} x="a" y="b" pointLabel="n" xScale={st.scale} /><Gate on={st.scale === 'log'} /></Suspense>;
      }
      const { container } = render(<Host />);
      await act(async () => {});
      const cx = () => [...container.querySelectorAll('circle.sg-scatter__point')].map((c) => Number(c.getAttribute('cx')));
      const before = cx();
      expect(before.length).toBe(3);
      /* the switch to log suspends and is thrown away: the chart stays linear */
      await act(async () => { startTransition(() => setS({ scale: 'log', data: A })); });
      expect(tried).toBeGreaterThan(0);   /* the log render did happen, and was thrown away */
      expect(cx()).toEqual(before);
      /* a real change, linear to linear: at its first frame (none has run) every point is where it was */
      await act(async () => { setS({ scale: 'linear', data: B }); });
      /* B is committed (its values are in the chart's table) and every point is still drawn */
      expect(container.textContent).toContain('200');
      const now = cx();
      expect(now.length).toBe(3);
      now.forEach((x, i) => expect(x).toBeCloseTo(before[i], 3));
    }
    void raf;
  });
  const cxOf = (c: HTMLElement) => [...c.querySelectorAll('circle.sg-scatter__point')].map((e) => Number(e.getAttribute('cx')));
  const holdFrames = () => { const frames: FrameRequestCallback[] = []; vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length; }); vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {}); return frames; };
  /* one clock for every frame run, so it never goes back */
  let clock = 0;
  const settle = async (frames: FrameRequestCallback[]) => { for (let k = 0; k < 400 && frames.length; k++) { clock += 50; const t = clock, f = frames.splice(0); await act(async () => { f.forEach((cb) => cb(t)); }); } };
  /* switched to log and given new data while hidden (Activity): shown again, every point starts where it was drawn, not
     at its new value read on the old axis (the third point started some 2,900 px off a 400 px plot) */
  it('a switch with new data while hidden starts every point where it was drawn', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const B = [{ n: 'p', a: 2, b: 1 }, { n: 'q', a: 30, b: 2 }, { n: 'r', a: 900, b: 3 }];
    const view = (mode: 'visible' | 'hidden', scale: 'linear' | 'log', data: typeof A) => <Activity mode={mode}><ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} /></Activity>;
    const { container, rerender } = render(view('visible', 'linear', A));
    await settle(frames);
    const before = cxOf(container);
    expect(before.length).toBe(3);
    await act(async () => { rerender(view('hidden', 'linear', A)); });
    await act(async () => { rerender(view('hidden', 'log', B)); });
    await act(async () => { rerender(view('visible', 'log', B)); });
    const first = cxOf(container);
    expect(first.length).toBe(3);
    first.forEach((x, i) => expect(x).toBeCloseTo(before[i], 2));
    /* and it ends on the log layout, inside the plot */
    await settle(frames);
    cxOf(container).forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(400); });
  });
  /* a switch that has settled is history: a later change within the same log bounds moves from the log layout (the
     points flew some 15,000 px off when the history still said the axis had switched) */
  it('a change after a settled switch, within the same bounds, starts every point where it was drawn', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const view = (scale: 'linear' | 'log', data: typeof A) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} />;
    const { container, rerender } = render(view('linear', A));
    await settle(frames);
    await act(async () => { rerender(view('log', A)); });
    await settle(frames);
    const before = cxOf(container);
    await act(async () => { rerender(view('log', [A[0], { ...A[1], a: 20 }, A[2]])); });
    const first = cxOf(container);
    expect(first.length).toBe(3);
    first.forEach((x, i) => expect(x).toBeCloseTo(before[i], 2));
  });
  /* new data while the switch is moving the points (#102): the new move starts from where each point is drawn (the
     middle point jumped from about 145 px to 70 px when it started from a mix of linear and log units) */
  const step = async (frames: FrameRequestCallback[], n: number) => { for (let k = 0; k < n && frames.length; k++) { clock += 16; const t = clock, f = frames.splice(0); await act(async () => { f.forEach((cb) => cb(t)); }); } };
  /* an axis's ticks as drawn: label → place and opacity */
  const xTicks = (c: HTMLElement) => new Map([...c.querySelectorAll('text.sg-chart__tick[text-anchor="middle"]')].map((e) => [e.textContent!, { x: Number(e.getAttribute('x')), o: Number(e.parentElement!.getAttribute('opacity') ?? 1) }]));
  const yTicks = (c: HTMLElement) => new Map([...c.querySelectorAll('text.sg-chart__tick[text-anchor="end"]')].map((e) => [e.textContent!, { x: Number(e.getAttribute('y')), o: Number(e.parentElement!.getAttribute('opacity') ?? 1) }]));
  /* every tick drawn before is drawn now at the same place and opacity, and no other tick shows */
  const sameTicks = (a: ReturnType<typeof xTicks>, b: ReturnType<typeof xTicks>) => {
    for (const [k, v] of a) { if (v.o < 0.01) continue; expect(b.get(k), k).toBeDefined(); expect(b.get(k)!.x, k).toBeCloseTo(v.x, 1); expect(b.get(k)!.o, k).toBeCloseTo(v.o, 2); }
    for (const [k, v] of b) if (!a.has(k)) expect(v.o, k).toBeLessThan(0.01);
  };
  it.each([0, 3])('new data during a switch to log, %i frames in, starts every point where it is drawn', async (n) => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const view = (scale: 'linear' | 'log', data: typeof A) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} />;
    const { container, rerender } = render(view('linear', A));
    await settle(frames);
    const lin = cxOf(container);
    await act(async () => { rerender(view('log', A)); });
    await step(frames, n);
    const mid = cxOf(container), midTicks = xTicks(container);
    /* none run: still where it was; some: the switch is under way, the middle point between its linear place and its log one */
    if (n) expect(Math.abs(mid[1] - lin[1])).toBeGreaterThan(1); else mid.forEach((x, i) => expect(x).toBeCloseTo(lin[i], 2));
    await act(async () => { rerender(view('log', [A[0], { ...A[1], a: 20 }, A[2]])); });
    const first = cxOf(container);
    expect(first.length).toBe(3);
    first.forEach((x, i) => expect(x).toBeCloseTo(mid[i], 2));
    /* the gridlines and their labels too: where they were drawn, as faded as they were */
    sameTicks(midTicks, xTicks(container));
    /* and it goes on smoothly, ending on the log layout of the new data, inside the plot */
    await step(frames, 1);
    cxOf(container).forEach((x, i) => expect(Math.abs(x - first[i])).toBeLessThan(40));
    await settle(frames);
    const end = cxOf(container);
    await act(async () => { rerender(view('log', [A[0], { ...A[1], a: 20 }, A[2]])); });
    expect(cxOf(container)).toEqual(end);
    expect(end[0]).toBeLessThan(end[1]); expect(end[1]).toBeLessThan(end[2]);
    end.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(400); });
  });
  /* new data that moves the bounds: the linear ticks the switch had left do not come back */
  it('new data with new bounds during a switch keeps the ticks where they are drawn', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const view = (scale: 'linear' | 'log', data: typeof A) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} />;
    const { container, rerender } = render(view('linear', A));
    await settle(frames);
    await act(async () => { rerender(view('log', A)); });
    await step(frames, 3);
    const mid = cxOf(container), midTicks = xTicks(container);
    await act(async () => { rerender(view('log', [A[0], A[1], { ...A[2], a: 105 }])); });
    cxOf(container).forEach((x, i) => expect(x).toBeCloseTo(mid[i], 2));
    sameTicks(midTicks, xTicks(container));
    /* one frame on, every tick has moved a little, none jumped */
    const one = xTicks(container); await step(frames, 1);
    for (const [k, v] of xTicks(container)) if (one.has(k)) { expect(Math.abs(v.x - one.get(k)!.x), k).toBeLessThan(40); expect(Math.abs(v.o - one.get(k)!.o), k).toBeLessThan(0.3); }
    await settle(frames);
    for (const [, v] of xTicks(container)) expect(v.o).toBe(1);
  });
  /* new data again and again while a switch runs (a live feed): each new move carries on from the last, at no growing
     cost, and the ticks stay put and keep their labels at each one */
  it('new data many times during a switch keeps every point and tick where it is drawn', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const view = (data: typeof A, scale: 'linear' | 'log' = 'log') => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} />;
    const { container, rerender } = render(view(A, 'linear'));
    await settle(frames);
    await act(async () => { rerender(view(A)); });
    await step(frames, 2);
    const t0 = performance.now();
    for (let n = 1; n <= 30; n++) {
      const mid = cxOf(container), midTicks = xTicks(container);
      await act(async () => { rerender(view([A[0], { ...A[1], a: 10 + n }, { ...A[2], a: 100 + n * 7 }])); });
      cxOf(container).forEach((x, i) => expect(x).toBeCloseTo(mid[i], 1));
      sameTicks(midTicks, xTicks(container));
      await step(frames, 1);
    }
    expect(performance.now() - t0).toBeLessThan(3000);
    await settle(frames);
    for (const [, v] of xTicks(container)) expect(v.o).toBe(1);
  });
  /* switched back to linear before the switch to log ends: once settled, the linear axis has all its ticks, 0 included
     (a tick with no place on the log axis) */
  it('a switch back before the switch ends settles with every tick of the axis', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const view = (scale: 'linear' | 'log') => <ScatterChart aria-label="s" data={A} x="a" y="b" pointLabel="n" xScale={scale} />;
    const { container, rerender } = render(view('linear'));
    await settle(frames);
    const lin = [...xTicks(container).keys()];
    expect(lin).toContain('0');
    await act(async () => { rerender(view('log')); });
    await step(frames, 3);
    await act(async () => { rerender(view('linear')); });
    await settle(frames);
    const end = xTicks(container);
    expect([...end.keys()].sort()).toEqual([...lin].sort());
    for (const [, v] of end) expect(v.o).toBe(1);
  });
  /* laid out again mid-move with the same bounds (fewer ticks for a shorter chart), then new data: the ticks carried
     are the ones drawn */
  it('new data after a relayout mid-switch keeps the ticks drawn', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 10 }, { n: 'r', a: 100, b: 100 }];
    const view = (scale: 'linear' | 'log', height: number, data = A) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" yScale={scale} height={height} />;
    const { container, rerender } = render(view('log', 280));
    await settle(frames);
    await act(async () => { rerender(view('linear', 280)); });
    await step(frames, 3);
    await act(async () => { rerender(view('linear', 112)); });
    await step(frames, 1);
    const mid = yTicks(container);
    await act(async () => { rerender(view('linear', 112, [A[0], { ...A[1], b: 12 }, A[2]])); });
    sameTicks(mid, yTicks(container));
  });
  /* a switch to linear reversed before it ends: the 0 tick, drawn on the way, stays where it is and fades out (it has
     no place on a log axis) */
  it('a switch to linear reversed mid-move keeps the 0 tick where it is drawn, fading out', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const view = (scale: 'linear' | 'log', data = A) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} />;
    const { container, rerender } = render(view('log'));
    await settle(frames);
    await act(async () => { rerender(view('linear')); });
    await step(frames, 3);
    const mid = xTicks(container);
    expect(mid.get('0')?.o ?? 0).toBeGreaterThan(0.01);
    await act(async () => { rerender(view('log', [A[0], { ...A[1], a: 20 }, A[2]])); });
    sameTicks(mid, xTicks(container));
    await step(frames, 1);
    expect(xTicks(container).get('0')?.o ?? 0).toBeLessThan(mid.get('0')!.o);
    await settle(frames);
    expect(xTicks(container).has('0')).toBe(false);
  });
  /* a tick the switch had outside the plot (clipped) is not carried: the next move fades it in where it goes */
  it('new data during a switch fades in the ticks it shows, drawn at once', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const view = (scale: 'linear' | 'log', data = A) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} />;
    const { container, rerender } = render(view('linear'));
    await settle(frames);
    /* the switch brings a far greater value: its tick starts far outside the plot */
    await act(async () => { rerender(view('log', [A[0], A[1], { ...A[2], a: 10000 }])); });
    await step(frames, 2);
    await act(async () => { rerender(view('log', [A[0], A[1], { ...A[2], a: 11000 }])); });
    await step(frames, 2);
    const during = xTicks(container);
    await settle(frames);
    /* every tick of the new axis is already drawn, fading in, not held outside the plot */
    for (const k of xTicks(container).keys()) expect(during.get(k)?.o ?? 0, k).toBeGreaterThan(0.01);
  });
  /* a point and its gridline move together when new bounds interrupt a switch */
  it('new bounds during a switch keep an unchanged point on its gridline', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }, { n: 's', a: 100, b: 4 }];
    const view = (scale: 'linear' | 'log', data = A) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} />;
    const { container, rerender } = render(view('linear'));
    await settle(frames);
    await act(async () => { rerender(view('log')); });
    await step(frames, 3);
    await act(async () => { rerender(view('log', [A[0], A[1], A[2], { ...A[3], a: 1e8 }])); });
    for (let n = 0; n < 12; n++) {
      const t = xTicks(container).get('100');
      if (t && t.o > 0.01) expect(cxOf(container)[2], `frame ${n}`).toBeCloseTo(t.x, 0);
      await step(frames, 1);
    }
  });
  /* a tick leaving keeps the label it was drawn with, through new data twice, each with a new format (the axis keeps
     only the format before its present ticks) */
  it('a tick leaving keeps its label through two changes mid-switch', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 2 }, { n: 'r', a: 100, b: 3 }];
    const view = (scale: 'linear' | 'log', data = A, xFormat?: (v: number) => string) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" xScale={scale} xFormat={xFormat} />;
    const { container, rerender } = render(view('linear'));
    await settle(frames);
    await act(async () => { rerender(view('log')); });
    await step(frames, 3);
    expect(xTicks(container).get('1')?.o ?? 0).toBeGreaterThan(0.01);
    /* 1 leaves the axis */
    await act(async () => { rerender(view('log', [{ ...A[0], a: 20 }, { ...A[1], a: 50 }, A[2]], (v) => `#${v}`)); });
    await step(frames, 1);
    const before = xTicks(container);
    expect(before.get('1')?.o ?? 0).toBeGreaterThan(0.01);
    /* new ticks again, with another format: 1, still fading out, is still "1" */
    await act(async () => { rerender(view('log', [{ ...A[0], a: 200 }, { ...A[1], a: 500 }, { ...A[2], a: 1000 }], (v) => `@${v}`)); });
    const now = xTicks(container);
    expect(now.get('1'), JSON.stringify([...now.keys()])).toBeDefined();
    expect(now.get('1')!.x).toBeCloseTo(before.get('1')!.x, 1);
    expect(now.get('1')!.o).toBeCloseTo(before.get('1')!.o, 2);
  });
  /* the same on the y axis, and switched back to linear with new data mid-switch */
  it('new data with a switch back, mid-switch, on either axis, starts every point where it is drawn', async () => {
    const frames = holdFrames();
    const A = [{ n: 'p', a: 1, b: 1 }, { n: 'q', a: 10, b: 10 }, { n: 'r', a: 100, b: 100 }];
    const B = [{ n: 'p', a: 1, b: 2 }, { n: 'q', a: 10, b: 30 }, { n: 'r', a: 100, b: 90 }];
    const cyOf = (c: HTMLElement) => [...c.querySelectorAll('circle.sg-scatter__point')].map((e) => Number(e.getAttribute('cy')));
    const view = (scale: 'linear' | 'log', data: typeof A) => <ScatterChart aria-label="s" data={data} x="a" y="b" pointLabel="n" yScale={scale} />;
    const { container, rerender } = render(view('linear', A));
    await settle(frames);
    await act(async () => { rerender(view('log', A)); });
    await step(frames, 3);
    const mid = cyOf(container);
    await act(async () => { rerender(view('linear', B)); });
    const first = cyOf(container);
    first.forEach((y, i) => expect(y).toBeCloseTo(mid[i], 2));
    await settle(frames);
    const end = cyOf(container);
    /* linear B: higher values higher up (a smaller y) */
    expect(end[0]).toBeGreaterThan(end[1]); expect(end[1]).toBeGreaterThan(end[2]);
  });
});

describe('charts: values that are not finite numbers', () => {
  it('a bar chart treats NaN and Infinity as gaps, not as a 0–1 axis', () => {
    const { container } = render(<BarChart aria-label="b" x="x" series={[{ key: 'v', label: 'V' }, { key: 'w', label: 'W' }]} stacked
      data={[{ x: 'a', v: 10, w: NaN }, { x: 'b', v: Infinity, w: 4 }]} />);
    const ticks = [...container.querySelectorAll('svg .sg-chart__tick')].map((t) => t.textContent);
    expect(ticks).toContain('10');
    expect(ticks).not.toContain('1');
    expect([...container.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['10', '—', '—', '4']);
  });
  it('a donut shows its real total (0 when empty) and keeps shares clear of NaN', () => {
    const { container, rerender } = render(<DonutChart aria-label="d" data={[{ label: 'a', value: 0 }, { label: 'b', value: 0 }]} />);
    expect(container.querySelector('.sg-donut__value')!.textContent).toBe('0');
    rerender(<DonutChart aria-label="d" data={[]} />);
    expect(container.querySelector('.sg-donut__value')!.textContent).toBe('0');
    rerender(<DonutChart aria-label="d" data={[{ label: 'a', value: 1 }, { label: 'b', value: NaN }, { label: 'c', value: 1 }]} />);
    expect([...container.querySelectorAll('.sg-donut__pct')].map((p) => p.textContent)).toEqual(['50%', '0%', '50%']);
    expect([...container.querySelectorAll('.sg-donut__num')].map((p) => p.textContent)).toEqual(['1', '—', '1']);
    expect(container.querySelector('.sg-donut__value')!.textContent).toBe('2');
  });
  it('a donut with nothing to share out draws its empty track, and one with values does not (#61)', () => {
    const { container, rerender } = render(<DonutChart aria-label="d" data={[{ label: 'a', value: 0 }, { label: 'b', value: 0 }]} />);
    expect(container.querySelectorAll('.sg-donut__track')).toHaveLength(1);
    expect(container.querySelector('.sg-donut__ring')!.getAttribute('aria-label')).toBe('d: no data');   /* said, not only drawn */
    rerender(<DonutChart aria-label="d" data={[]} />);
    expect(container.querySelectorAll('.sg-donut__track')).toHaveLength(1);
    rerender(<DonutChart aria-label="d" data={[{ label: 'a', value: 1 }, { label: 'b', value: 0 }]} />);
    expect(container.querySelector('.sg-donut__track')).toBeNull();
  });
  it('an empty donut has no slice to step to: the keys leave its total showing', () => {
    const { container } = render(<DonutChart aria-label="d" data={[{ label: 'a', value: 0 }]} />);
    const ring = container.querySelector<HTMLElement>('.sg-donut__ring')!;
    fireEvent.keyDown(ring, { key: 'ArrowRight' });
    expect(container.querySelector('.sg-donut__value')!.textContent).toBe('0');
  });
  it('a negative donut slice counts as 0 and shows 0%, not a negative share', () => {
    const { container } = render(<DonutChart aria-label="d" data={[{ label: 'a', value: 1 }, { label: 'b', value: -1 }, { label: 'c', value: 1 }]} />);
    expect([...container.querySelectorAll('.sg-donut__pct')].map((p) => p.textContent)).toEqual(['50%', '0%', '50%']);
    expect([...container.querySelectorAll('.sg-donut__num')].map((p) => p.textContent)).toEqual(['1', '-1', '1']);
    expect(container.querySelector('.sg-donut__value')!.textContent).toBe('2');
    fireEvent.keyDown(container.querySelector('.sg-donut__ring')!, { key: 'ArrowRight' });
    fireEvent.keyDown(container.querySelector('.sg-donut__ring')!, { key: 'ArrowRight' });
    expect(container.querySelector('.sg-donut__value')!.textContent).toBe('0%');
  });
});

describe('charts: numbers at the step\'s precision', () => {
  const ticksOf = (c: HTMLElement) => [...c.querySelectorAll('svg text.sg-chart__tick')].map((t) => t.textContent).filter((t) => t && /\d/.test(t));
  it('a tiny domain\'s tick labels are distinct and not 0 (#61)', () => {
    const { container } = render(<LineChart aria-label="l" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: 1e-12 }, { x: 'b', v: 9e-12 }]} />);
    const t = ticksOf(container);
    expect(t.length).toBeGreaterThan(2);
    expect(new Set(t).size).toBe(t.length);
    expect(t.filter((x) => x === '0')).toHaveLength(1);   /* only the zero tick */
    expect(t).toContain('2E-12');
    /* the values too: 3E-12, not 0 */
    expect([...container.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['1E-12', '9E-12']);
  });
  it('a step of 0.25 reads 0.25 and 0.75, not 0.3 and 0.8; values below 1 keep two significant digits', () => {
    const { container } = render(<BarChart aria-label="b" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: 0.04 }, { x: 'b', v: 0.9 }]} height={200} />);
    const t = ticksOf(container);
    expect(t).toEqual(expect.arrayContaining(['0.25', '0.75']));
    expect(t).not.toContain('0.3');
    expect([...container.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['0.04', '0.9']);
  });
  it('large steps keep their digits in the compact form, in the locale\'s words', () => {
    const data = [{ x: 'a', v: 100000 }, { x: 'b', v: 1240000 }];
    const { container, rerender } = render(<BarChart aria-label="b" x="x" series={[{ key: 'v', label: 'V' }]} data={data} height={300} locale="en-US" />);
    expect(ticksOf(container)).toContain('1.25M');
    rerender(<BarChart aria-label="b" x="x" series={[{ key: 'v', label: 'V' }]} data={data} height={300} locale="ko-KR" />);
    expect(ticksOf(container)).toContain('125만');
  });
  it('a step of 0.0001 reads as decimals, from the nominal step, not the float gap', () => {
    const { container } = render(<LineChart aria-label="l" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: 1 }, { x: 'b', v: 1.0004 }]} />);
    const t = ticksOf(container);
    expect(t).toContain('1.0002');
    expect(t.some((x) => /E/.test(x!))).toBe(false);
  });
  it('huge values are short and distinct (scientific, not hundreds of compact digits)', () => {
    const { container } = render(<LineChart aria-label="l" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: 0 }, { x: 'b', v: 1e300 }]} />);
    const t = ticksOf(container);
    expect(new Set(t).size).toBe(t.length);
    expect(t.every((x) => x!.length <= 12)).toBe(true);
    expect(t.some((x) => /E300/.test(x!))).toBe(true);
    expect([...container.querySelectorAll('td')].map((td) => td.textContent)[1]).toBe('1E300');
  });
  it('a tick on its way out keeps the label of the axis it came from', () => {
    const { container, rerender } = render(<BarChart aria-label="b" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: 0.9 }]} height={200} />);
    expect(ticksOf(container)).toContain('0.25');
    rerender(<BarChart aria-label="b" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: 90 }]} height={200} />);
    /* the move has just begun: the old ticks are still drawn, at their own values */
    const t = ticksOf(container);
    expect(t).toContain('0.25');
    expect(t.filter((x) => x === '0')).toHaveLength(1);
  });
  it('the ticks fading out are the ones that were drawn, not ticks rebuilt from the old range', () => {
    const series = [{ key: 'v', label: 'V' }];
    const { container, rerender } = render(<LineChart aria-label="l" x="x" series={series} data={[{ x: 'a', v: 0.1 }, { x: 'b', v: 0.89 }]} />);
    const before = ticksOf(container);
    expect(before).toContain('0.2');
    rerender(<LineChart aria-label="l" x="x" series={series} data={[{ x: 'a', v: 0 }, { x: 'b', v: 90 }]} />);
    const during = ticksOf(container);
    /* the old 0.2-step labels are still there; a 0.25 step was never on screen */
    expect(during).toContain('0.2');
    expect(during.some((t) => t === '0.25' || t === '0.75')).toBe(false);
  });
  it('takes the step niceTicks chose, not one inferred from a float gap', () => {
    const { container } = render(<LineChart aria-label="l" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: 1e10 }, { x: 'b', v: 1e10 + 0.00035 }]} />);
    const t = ticksOf(container);
    expect(t.length).toBeGreaterThan(1);
    expect(new Set(t).size).toBe(t.length);
    expect(t.some((x) => /E/.test(x!))).toBe(false);   /* a 0.0001 step is not below the scientific cutoff */
  });
  it('the label gutter moves with the scale: the plot does not jump sideways when the labels change width', () => {
    const series = [{ key: 'v', label: 'V' }];
    const { container, rerender } = render(<BarChart aria-label="b" x="x" series={series} data={[{ x: 'a', v: 0.00041 }]} height={200} />);
    const edge = () => Math.min(...[...container.querySelectorAll('svg text.sg-chart__tick')].map((t) => Number(t.getAttribute('x'))).filter((n) => Number.isFinite(n) && n > 0));
    const before = edge();
    rerender(<BarChart aria-label="b" x="x" series={series} data={[{ x: 'a', v: 90 }]} height={200} />);
    expect(edge()).toBe(before);   /* the first frame of the move: still where it was */
  });
  it('values: -0 reads 0, and tiny values keep two significant digits', () => {
    const { container } = render(<LineChart aria-label="l" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: -0 }, { x: 'b', v: 0.000012345 }]} />);
    expect([...container.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['0', '1.2E-5']);
  });
  it('an app\'s own format still writes the ticks', () => {
    const { container } = render(<LineChart aria-label="l" x="x" series={[{ key: 'v', label: 'V' }]} data={[{ x: 'a', v: 0 }, { x: 'b', v: 1 }]} yFormat={(v) => `${v * 100}%`} />);
    const t = ticksOf(container);
    expect(t.length).toBeGreaterThan(1);
    expect(t.every((x) => x!.endsWith('%'))).toBe(true);
  });
});

describe('charts: long and sparse series', () => {
  it('a very long series does not overflow the call stack', () => {
    (globalThis as any).ResizeObserver = RealRO;   /* the width never comes: only the range is computed, not a 300k-point path */
    const values = Array.from({ length: 300_000 }, (_, i) => i % 1000);
    expect(() => render(<Sparkline values={values} />)).not.toThrow();
  }, 20_000);
  /* a behaviour guard for the one-pass rewrite: the old search gave the same values, only in quadratic time */
  it('a gap that fills in rises from the straight line between its neighbours (and level with the nearest value at the ends)', () => {
    const series = [{ key: 'v', label: 'V' }];
    const at = (v: (number | null)[]) => v.map((y, i) => ({ x: String(i), v: y }));
    const ys = (c: HTMLElement) => [...c.querySelector('.sg-chart__line')!.getAttribute('d')!.matchAll(/[ML][\d.-]+,([\d.-]+)/g)].map((m) => +m[1]);
    const { container, rerender } = render(<LineChart aria-label="l" curve="linear" x="x" series={series} data={at([null, 10, null, null, 40, null])} />);
    /* every gap filled at once: the first frame of the move shows where each one rises from, on the old scale
       (ticks 10–40, a plot 204 px tall from y 10) */
    rerender(<LineChart aria-label="l" curve="linear" x="x" series={series} data={at([999, 10, 999, 999, 40, 999])} />);
    const Y = (v: number) => 214 - ((v - 10) / 30) * 204;
    expect(ys(container)).toEqual([10, 10, 20, 30, 40, 40].map(Y));
  });
  it('the data table is built from the data, not on every frame', () => {
    const xFormat = vi.fn((v: string) => v);
    const data = Array.from({ length: 60 }, (_, i) => ({ x: String(i), v: i }));
    const { container } = render(<LineChart aria-label="l" x="x" xFormat={xFormat} series={[{ key: 'v', label: 'V' }]} data={data} />);
    const before = xFormat.mock.calls.length;
    fireEvent.keyDown(container.querySelector('.sg-chart__plot')!, { key: 'ArrowRight' });
    expect(xFormat.mock.calls.length - before).toBeLessThan(data.length);
  });
  it('the data table is not rebuilt on every frame when the options with defaults are left out either', () => {
    const data = Array.from({ length: 60 }, (_, i) => ({ x: String(i), v: i }));
    for (const Chart of [LineChart, BarChart]) {
      const yFormat = vi.fn((v: number) => String(v));   /* without xFormat: its default must keep the table */
      const { container, unmount } = render(<Chart aria-label="c" x="x" yFormat={yFormat} series={[{ key: 'v', label: 'V' }]} data={data} />);
      const before = yFormat.mock.calls.length;
      fireEvent.keyDown(container.querySelector('.sg-chart__plot')!, { key: 'ArrowRight' });
      expect(yFormat.mock.calls.length - before).toBeLessThan(data.length);
      unmount();
    }
    const xFormat = vi.fn((v: number) => String(v));   /* without groups */
    const pts = Array.from({ length: 60 }, (_, i) => ({ n: String(i), a: i, b: i }));
    const { container } = render(<ScatterChart aria-label="s" data={pts} x="a" y="b" pointLabel="n" xFormat={xFormat} />);
    const before = xFormat.mock.calls.length;
    fireEvent.keyDown(container.querySelector('.sg-chart__plot')!, { key: 'ArrowRight' });
    expect(xFormat.mock.calls.length - before).toBeLessThan(pts.length);
  });
});

describe('DataTable', () => {
  type R = { id: string; name: string; when?: Date };
  const many = (n: number): R[] => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `row ${i}` }));
  const cols: Column<R>[] = [{ key: 'name', header: 'Name' }];
  /* a 300 px box under a 44 px header: data row i lies at 44 + 44·i, the rows in sight are those clear of the header */
  /* the window follows a scroll in the next frame: the frames are run here when the test says */
  let frames: FrameRequestCallback[] = [];
  const scrolled = (box: HTMLElement) => {
    fireEvent.scroll(box);
    act(() => { const run = frames; frames = []; run.forEach((f) => f(performance.now())); });
  };
  const layout = () => {
    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => { frames.push(f); return frames.length; });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.tagName === 'THEAD' ? 44 : 0; });
  };
  it('keeps the tab stop and focus on a row in sight when the focused row scrolls out of a virtual window', () => {
    layout();
    const { container } = render(<DataTable<R> aria-label="t" rows={many(200)} columns={cols} rowKey={(r) => r.id} maxHeight={300} />);
    const box = container.querySelector<HTMLElement>('.sg-table')!;
    act(() => { container.querySelector<HTMLElement>('[data-r="3"][data-c="0"]')!.focus(); });
    expect(container.querySelector('[data-r="3"][data-c="0"]')!.getAttribute('tabindex')).toBe('0');
    /* down: the focused row went off the top; the first row in sight takes it (row 100 at the top of the box, not
       an overscan row behind the header) */
    box.scrollTop = 44 * 100;
    scrolled(box);
    expect(container.querySelector('[data-r="3"]')).toBeNull();
    let stops = container.querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('data-r')).toBe('100');
    /* and the keyboard focus is still in the grid, on the stop; the next key moves on from there, in place */
    expect(document.activeElement).toBe(stops[0]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement!.getAttribute('data-r')).toBe('101');
    expect(box.scrollTop).toBe(4400);
    /* up: the focused row went off the bottom; the last row wholly in sight takes it (row 4 ends at 264 px, row 5
       at 308, past the 300 px box) */
    box.scrollTop = 0;
    scrolled(box);
    stops = container.querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('data-r')).toBe('4');
    expect(document.activeElement).toBe(stops[0]);
    expect(box.scrollTop).toBe(0);
  });
  it('moves the window once a frame, however many scroll events the frame brings', () => {
    layout();
    const { container } = render(<DataTable<R> aria-label="t" rows={many(200)} columns={cols} rowKey={(r) => r.id} maxHeight={300} />);
    const box = container.querySelector<HTMLElement>('.sg-table')!;
    for (const y of [1000, 2000, 44 * 100]) { box.scrollTop = y; fireEvent.scroll(box); }
    expect(frames).toHaveLength(1);
    expect(container.querySelector('[data-r="100"]')).toBeNull();
    /* rendered in the frame itself, before anything after it: the window starts at row 100 less the overscan (a jump
       this long draws the fling's placeholder in place of the rows) */
    act(() => {
      const run = frames; frames = []; run.forEach((f) => f(performance.now()));
      expect(box.querySelector<HTMLElement>('tbody:last-of-type > tr[aria-hidden="true"]')!.style.height).toBe(`${(99 - 8) * 44}px`);
    });
  });
  it('a frame that comes after the row height changed measures with the new height', () => {
    layout();
    const { container, rerender } = render(<DataTable<R> aria-label="t" rows={many(200)} columns={cols} rowKey={(r) => r.id} maxHeight={300} />);
    const box = container.querySelector<HTMLElement>('.sg-table')!;
    box.scrollTop = 3600; fireEvent.scroll(box);
    rerender(<DataTable<R> aria-label="t" rows={many(200)} columns={cols} rowKey={(r) => r.id} maxHeight={300} density="compact" />);
    act(() => { const run = frames; frames = []; run.forEach((f) => f(performance.now())); });
    const spacer = () => box.querySelector<HTMLElement>('tbody:last-of-type tr[aria-hidden="true"]')!.style.height;
    const after = spacer();
    act(() => { observers.forEach((f) => f()); });   /* measured again now, with what the table has now */
    expect(spacer()).toBe(after);
  });
  describe('a fling', () => {
    const frame = () => act(() => { const run = frames; frames = []; run.forEach((f) => f(performance.now())); });
    const table = (n = 200) => <DataTable<R> aria-label="t" rows={many(n)} columns={cols} rowKey={(r) => r.id} maxHeight={300} />;
    const to = (box: HTMLElement, y: number) => { box.scrollTop = y; fireEvent.scroll(box); frame(); };
    const flingRow = (c: HTMLElement) => c.querySelector('.sg-table__fling');
    afterEach(() => { vi.useRealTimers(); });
    it('draws a still placeholder while each frame scrolls half the box or more, and the rows 120 ms after the last', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      layout();
      const { container } = render(table());
      const box = container.querySelector<HTMLElement>('.sg-table')!;
      to(box, 44 * 50);
      expect(flingRow(container)).not.toBeNull();
      expect(container.querySelector('tbody:last-of-type [data-r]')).toBeNull();
      act(() => { vi.advanceTimersByTime(100); });
      to(box, 44 * 100);   /* still flying, 100 ms on: the wait starts again */
      act(() => { vi.advanceTimersByTime(100); });
      expect(flingRow(container)).not.toBeNull();
      act(() => { vi.advanceTimersByTime(20); });
      expect(flingRow(container)).toBeNull();
      expect(container.querySelector('[data-r="100"]')).not.toBeNull();
    });
    it('keeps the rows for a frame that scrolls less than half the box, wherever the table is', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      layout();
      const { container } = render(table());
      const box = container.querySelector<HTMLElement>('.sg-table')!;
      to(box, 4400); act(() => { vi.advanceTimersByTime(200); });
      to(box, 4400 + 149);
      expect(flingRow(container)).toBeNull();
      to(box, 4400 + 149 + 150);
      expect(flingRow(container)).not.toBeNull();
    });
    it('keeps the rows while the grid holds the focus', () => {
      layout();
      const { container } = render(table());
      const box = container.querySelector<HTMLElement>('.sg-table')!;
      act(() => { container.querySelector<HTMLElement>('[data-r="3"][data-c="0"]')!.focus(); });
      to(box, 44 * 100);
      expect(flingRow(container)).toBeNull();
      expect(box.contains(document.activeElement)).toBe(true);
    });
    it('ends at once when focus comes in or the table is pressed, and the keys work from there', () => {
      layout();
      const { container } = render(table());
      const box = container.querySelector<HTMLElement>('.sg-table')!;
      to(box, 44 * 100);
      expect(flingRow(container)).not.toBeNull();
      /* Tab lands on the stop the header holds meanwhile */
      act(() => { container.querySelector<HTMLElement>('[tabindex="0"]')!.focus(); });
      expect(flingRow(container)).toBeNull();
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
      expect(document.activeElement!.getAttribute('data-r')).not.toBe('-1');
      act(() => { (document.activeElement as HTMLElement).blur(); });
      to(box, 44 * 150);
      fireEvent.pointerDown(box);
      expect(flingRow(container)).toBeNull();
    });
    it('shows the rows of a table that stops being virtual', () => {
      layout();
      const { container, rerender } = render(table());
      const box = container.querySelector<HTMLElement>('.sg-table')!;
      to(box, 44 * 100);
      expect(flingRow(container)).not.toBeNull();
      rerender(table(20));
      expect(flingRow(container)).toBeNull();
      expect(container.querySelectorAll('tbody:last-of-type tr[aria-rowindex]')).toHaveLength(20);
    });
    it('keeps the rows in forced colours, which would take the placeholder away', () => {
      layout();
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('forced-colors'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
      const { container } = render(table());
      const box = container.querySelector<HTMLElement>('.sg-table')!;
      to(box, 44 * 100);
      expect(flingRow(container)).toBeNull();
      vi.unstubAllGlobals();
    });
  });
  it('does not take the focus back once it has left the grid', async () => {
    layout();
    const { container } = render(<><DataTable<R> aria-label="t" rows={many(200)} columns={cols} rowKey={(r) => r.id} maxHeight={300} /><button>elsewhere</button></>);
    const box = container.querySelector<HTMLElement>('.sg-table')!;
    act(() => { container.querySelector<HTMLElement>('[data-r="3"][data-c="0"]')!.focus(); });
    /* a click on the page: the cell loses focus to nothing */
    act(() => { (document.activeElement as HTMLElement).blur(); });
    await act(async () => {});
    box.scrollTop = 44 * 100;
    scrolled(box);
    expect(document.activeElement).toBe(document.body);
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    /* the rows fly past as a placeholder: the column's header holds the stop meanwhile */
    expect(container.querySelector('[tabindex="0"]')!.getAttribute('data-r')).toBe('-1');
  });
  it('a resize measures the window with the current row height', () => {
    const { container, rerender } = render(<DataTable<R> aria-label="t" rows={many(200)} columns={cols} rowKey={(r) => r.id} maxHeight={300} />);
    const box = container.querySelector<HTMLElement>('.sg-table')!;
    rerender(<DataTable<R> aria-label="t" rows={many(200)} columns={cols} rowKey={(r) => r.id} maxHeight={300} density="compact" />);
    box.scrollTop = 3600;
    act(() => { observers.forEach((f) => f()); });
    const spacer = box.querySelector<HTMLElement>('tbody:last-of-type tr[aria-hidden="true"]')!;
    expect(spacer.style.height).toBe(`${(3600 / 36 - 8) * 36}px`);
  });
  /* a behaviour guard for the Set: the old search gave the same result, only in O(n·m) time */
  it('deselecting all keeps the selected keys that are not in the rows', () => {
    const on = vi.fn();
    const rows = many(5000), selected = [...rows.map((r) => r.id), 'elsewhere'];
    render(<DataTable<R> aria-label="t" rows={rows} columns={cols} rowKey={(r) => r.id} maxHeight={300} selectable selected={selected} onSelectedChange={on} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /all/i }));
    expect(on).toHaveBeenLastCalledWith(['elsewhere']);
  });
  it('sorts a column of dates and text the same whatever order the rows come in', () => {
    type M = { id: string; v: Date | string };
    const rows: M[] = [{ id: 'x', v: 'Zulu' }, { id: 'a', v: new Date(2024, 0, 8) }, { id: 'y', v: 'alpha' }, { id: 'b', v: new Date(2024, 0, 5) }];
    const order = (rs: M[]) => {
      const { container, unmount } = render(<DataTable<M> aria-label="t" rows={rs} rowKey={(r) => r.id} defaultSort={{ key: 'v', dir: 'asc' }}
        columns={[{ key: 'id', header: 'Id' }, { key: 'v', header: 'V', sortable: true, render: (r) => String(r.v) }]} />);
      const out = [...container.querySelectorAll('tbody:last-of-type tr th')].map((th) => th.textContent);
      unmount();
      return out;
    };
    expect(order(rows)).toEqual(['b', 'a', 'y', 'x']);
    expect(order([...rows].reverse())).toEqual(['b', 'a', 'y', 'x']);
  });
  it('sorts dates by time, not by their text', () => {
    const rows: R[] = [{ id: 'a', name: 'Fri 5', when: new Date(2024, 0, 5) }, { id: 'b', name: 'Mon 8', when: new Date(2024, 0, 8) }, { id: 'c', name: 'Sat 6', when: new Date(2024, 0, 6) }, { id: 'd', name: 'none', when: new Date(NaN) }];
    const { container } = render(<DataTable<R> aria-label="t" rows={rows} rowKey={(r) => r.id} defaultSort={{ key: 'when', dir: 'asc' }}
      columns={[{ key: 'name', header: 'Name' }, { key: 'when', header: 'When', sortable: true, render: (r) => String(r.when?.getTime()) }]} />);
    expect([...container.querySelectorAll('tbody:last-of-type tr th')].map((th) => th.textContent)).toEqual(['Fri 5', 'Sat 6', 'Mon 8', 'none']);
  });
});

describe('MediaViewer', () => {
  const labels = { close: 'Close', previous: 'Previous', next: 'Next' };
  const three = [{ alt: 'one', width: 4, height: 3, render: () => <div /> }, { alt: 'two', width: 4, height: 3, render: () => <div /> }, { alt: 'three', width: 4, height: 3, render: () => <div /> }];
  it('opens without items: a bar with its close button, nothing thrown', () => {
    expect(() => render(<MediaViewer open onClose={() => {}} items={[]} aria-label="Photos" labels={labels} />)).not.toThrow();
    expect(screen.getByRole('dialog', { name: 'Photos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
  it('opens and closes without items when getOrigin looks the item up, and gives the page back', async () => {
    const items: (MediaItem & { el?: HTMLElement })[] = [];
    const getOrigin = (i: number) => items[i].el;   /* as an app writes it: throws for an item that is not there */
    const { rerender } = render(<MediaViewer open onClose={() => {}} items={items} getOrigin={getOrigin} labels={labels} />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<MediaViewer open={false} onClose={() => {}} items={items} getOrigin={getOrigin} labels={labels} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
  });
  it('gives the page\'s scroll back even when opening throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const getOrigin = vi.fn(() => { throw new Error('app'); });
    /* React reports the error and takes the tree down (rethrown or not, by version): the release still runs */
    const caught = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', caught);
    try { render(<MediaViewer open onClose={() => {}} items={three} getOrigin={getOrigin} labels={labels} />); } catch { /* */ }
    window.removeEventListener('error', caught);
    /* what threw was the app's getOrigin, not something before it */
    expect(getOrigin).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
  const tx = (el: HTMLElement) => parseFloat(el.style.transform.replace('translateX(', '') || '0');
  it('pages to the next index the parent sets, on the paging spring', async () => {
    const { baseElement, rerender } = render(<MediaViewer open onClose={() => {}} items={three} index={0} labels={labels} />);
    const track = baseElement.querySelector<HTMLElement>('.sg-media__track')!;
    const pitch = parseFloat(baseElement.querySelector<HTMLElement>('[data-sg-slide="1"]')!.style.transform.replace('translateX(', ''));
    rerender(<MediaViewer open onClose={() => {}} items={three} index={1} labels={labels} />);
    /* not a jump: it starts where it was, passes between, and settles on the new item */
    expect(tx(track)).toBe(0);
    await waitFor(() => expect(tx(track)).toBeLessThan(-pitch / 4), { timeout: 3000 });
    expect(tx(track)).toBeGreaterThan(-pitch);
    await waitFor(() => expect(tx(track)).toBe(-pitch), { timeout: 3000 });
  });
  /* the new item faded in, as fade() does it: its layer animates opacity from 0 */
  const fadesIn = (spy: { mock: { contexts: unknown[]; calls: unknown[][] } }, el: Element | null) =>
    spy.mock.calls.some((c, k) => spy.mock.contexts[k] === el && (c[0] as Keyframe[])[0]?.opacity === 0);
  it('an index more than one item away fades in in place: the stage never slides through missing items', async () => {
    const six = [...three, ...three].map((x, i) => ({ ...x, alt: `p${i}` }));
    const spy = vi.spyOn(Element.prototype, 'animate');
    const { baseElement, rerender } = render(<MediaViewer open onClose={() => {}} items={six} index={0} labels={labels} />);
    const track = baseElement.querySelector<HTMLElement>('.sg-media__track')!;
    const pitch = parseFloat(baseElement.querySelector<HTMLElement>('[data-sg-slide="1"]')!.style.transform.replace('translateX(', ''));
    rerender(<MediaViewer open onClose={() => {}} items={six} index={5} labels={labels} />);
    /* at once on the new item, which is mounted: no frame shows the stage between */
    expect(tx(track)).toBe(-5 * pitch);
    const slide = baseElement.querySelector<HTMLElement>('[data-sg-slide="5"]');
    expect(slide).not.toBeNull();
    await waitFor(() => expect(fadesIn(spy, slide!.querySelector(".sg-media__dismiss"))).toBe(true));
    spy.mockRestore();
  });
  it('two steps before the track has moved are a far move too (measured from the track, not the last index)', () => {
    const { baseElement, rerender } = render(<MediaViewer open onClose={() => {}} items={three} index={0} labels={labels} />);
    const track = baseElement.querySelector<HTMLElement>('.sg-media__track')!;
    const pitch = parseFloat(baseElement.querySelector<HTMLElement>('[data-sg-slide="1"]')!.style.transform.replace('translateX(', ''));
    rerender(<MediaViewer open onClose={() => {}} items={three} index={1} labels={labels} />);
    rerender(<MediaViewer open onClose={() => {}} items={three} index={2} labels={labels} />);
    expect(tx(track)).toBe(-2 * pitch);
  });
  it('with reduced motion, an index the parent sets fades in in place', async () => {
    const spy = vi.spyOn(Element.prototype, 'animate');
    const at = (i: number) => <ThemeProvider theme={createTheme({ reduceMotion: true })}><MediaViewer open onClose={() => {}} items={three} index={i} labels={labels} /></ThemeProvider>;
    const { baseElement, rerender } = render(at(0));
    const track = baseElement.querySelector<HTMLElement>('.sg-media__track')!;
    const pitch = parseFloat(baseElement.querySelector<HTMLElement>('[data-sg-slide="1"]')!.style.transform.replace('translateX(', ''));
    rerender(at(1));
    expect(tx(track)).toBe(-pitch);
    const slide = baseElement.querySelector<HTMLElement>('[data-sg-slide="1"]');
    await waitFor(() => expect(fadesIn(spy, slide!.querySelector(".sg-media__dismiss"))).toBe(true));
    spy.mockRestore();
  });
  it('a page change the parent declines leaves the photo on the index it keeps', async () => {
    const { baseElement } = render(<MediaViewer open onClose={() => {}} items={three} index={0} onIndexChange={() => {}} labels={labels} />);
    const track = baseElement.querySelector<HTMLElement>('.sg-media__track')!;
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'End' });
    await new Promise((r) => setTimeout(r, 200));
    expect(tx(track)).toBe(0);
    expect(screen.getByText('1 / 3')).toBeTruthy();
    /* a swipe that lets go past the threshold: the track goes back from where the finger left it */
    const stage = baseElement.querySelector<HTMLElement>('.sg-media__stage')!;
    const ev = (type: string, x: number, el: EventTarget = window) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 100 }));
    act(() => { ev('pointerdown', 600, stage); for (let x = 580; x >= 200; x -= 20) ev('pointermove', x); });
    expect(tx(track)).toBeLessThan(-100);
    act(() => { ev('pointerup', 200); });
    await waitFor(() => expect(tx(track)).toBe(0), { timeout: 3000 });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });
  /* keyed by source, not position, in a Map (an object answered "constructor"): the new item takes its own shape */
  it('forgets the size read from an image when the items change', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    const { baseElement, rerender } = render(<MediaViewer open onClose={() => {}} items={[{ src: 'a.jpg', alt: 'a' }]} labels={labels} />);
    const img = baseElement.querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: 1000, configurable: true }); Object.defineProperty(img, 'naturalHeight', { value: 500, configurable: true });
    fireEvent.load(img);
    const frame = () => baseElement.querySelector<HTMLElement>('.sg-media__frame')!.style;
    expect([frame().width, frame().height]).toEqual(['800px', '400px']);
    rerender(<MediaViewer open onClose={() => {}} items={[{ src: 'constructor', alt: 'c' }]} labels={labels} />);
    expect([frame().width, frame().height]).toEqual(['800px', '600px']);
    /* and the size of a source no longer in the items is dropped, not kept for good */
    rerender(<MediaViewer open onClose={() => {}} items={[{ src: 'a.jpg', alt: 'a' }]} labels={labels} />);
    expect([frame().width, frame().height]).toEqual(['800px', '600px']);
  });
  it('an item\'s own size comes before a size read from another slide of the same source', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    const { baseElement } = render(<MediaViewer open onClose={() => {}} items={[{ src: 's.jpg', alt: 'wide' }, { src: 's.jpg', alt: 'square', width: 1, height: 1 }]} labels={labels} />);
    const img = baseElement.querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: 1000 }); Object.defineProperty(img, 'naturalHeight', { value: 500 });
    fireEvent.load(img);
    const frames = [...baseElement.querySelectorAll<HTMLElement>('.sg-media__frame')].map((f) => [f.style.width, f.style.height]);
    expect(frames).toEqual([['800px', '400px'], ['600px', '600px']]);
  });
  it('keeps focus in the viewer when a page button reaches its end, as Chromium drops it', () => {
    /* Chromium moves focus off a button the moment it is disabled, before layout effects run */
    const set = Element.prototype.setAttribute;
    vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (this: Element, k: string, v: string) {
      set.call(this, k, v);
      if (k === 'disabled' && this === document.activeElement) (this as HTMLElement).blur();
    });
    function T() { const [i, setI] = useState(1); return <MediaViewer open onClose={() => {}} items={three} index={i} onIndexChange={setI} labels={labels} />; }
    render(<T />);
    const next = screen.getByRole('button', { name: 'Next' });
    act(() => next.focus());
    fireEvent.click(next);
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Previous' }));
  });
  it('keeps focus in the viewer when the items change under a page button', () => {
    const { rerender } = render(<MediaViewer open onClose={() => {}} items={three} index={1} labels={labels} />);
    act(() => screen.getByRole('button', { name: 'Next' }).focus());
    rerender(<MediaViewer open onClose={() => {}} items={three.slice(0, 2)} index={1} labels={labels} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Previous' }));
    rerender(<MediaViewer open onClose={() => {}} items={three.slice(0, 2)} index={0} labels={labels} />);
    act(() => screen.getByRole('button', { name: 'Next' }).focus());
    rerender(<MediaViewer open onClose={() => {}} items={three.slice(0, 1)} index={0} labels={labels} />);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
  it('a swipe down lets go of held animations once, not on every move', () => {
    const spy = vi.spyOn(Element.prototype, 'getAnimations');
    const { baseElement } = render(<MediaViewer open onClose={() => {}} items={three} labels={labels} />);
    const stage = baseElement.querySelector<HTMLElement>('.sg-media__stage')!;
    const at = (type: string, y: number, el: EventTarget = window) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 100, clientY: y }));
    act(() => { at('pointerdown', 100, stage); });
    spy.mockClear();
    act(() => { for (let y = 120; y <= 200; y += 20) at('pointermove', y); });
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('charts: hidden mid-change and shown again (#82)', () => {
  /* Activity, and Suspense hiding a shown tree, take a chart's layout effects down and set them up again: a change
     caught mid-way settles at its target the moment it is shown (it does not stay frozen, nor replay), and a later
     change still moves over several frames */
  const frames: FrameRequestCallback[] = [];
  let t = 0;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { t += 16; for (const cb of frames.splice(0)) cb(t); } };
  const settle = () => { for (let i = 0; i < 300 && frames.length; i++) step(); };
  beforeEach(() => {
    frames.length = 0; t = performance.now();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });
  /* a child that suspends while `hold` is set: a plain (not transition) update makes Suspense hide what it showed */
  const gate = { hold: false, wake: () => {} };
  function Gate() { if (gate.hold) throw new Promise<void>((r) => { gate.wake = r; }); return null; }
  const wrap = (how: 'activity' | 'suspense', shown: boolean, chart: ReactElement) => how === 'activity'
    ? <Activity mode={shown ? 'visible' : 'hidden'}>{chart}</Activity>
    : <Suspense fallback={<p>loading</p>}>{chart}<Gate /></Suspense>;
  const charts: [string, (v: number[]) => ReactElement, string][] = [
    ['a bar chart (useMorph)', (v) => <BarChart aria-label="b" x="x" series={[{ key: 'v', label: 'V' }]} data={v.map((n, i) => ({ x: `c${i}`, v: n }))} />, '.sg-chart__bar'],
    ['a sparkline (useTween)', (v) => <Sparkline aria-label="s" values={v} />, 'svg path'],
  ];
  for (const how of ['activity', 'suspense'] as const) for (const [name, chart, sel] of charts) {
    it(`${name} hidden by ${how}: at its target when shown, and the next change moves`, () => {
      /* the shapes as drawn; generated ids (a gradient's) differ between renders and are left out */
      const drawn = (c: HTMLElement) => [...c.querySelectorAll(sel)].map((e) => e.outerHTML.replace(/url\(#[^)]*\)/g, 'url(#)')).join('');
      const ref = (v: number[]) => { const r = render(chart(v)); act(() => {}); const d = drawn(r.container); r.unmount(); return d; };
      const A = [1, 4, 2, 5], B = [5, 1, 4, 2], C = [2, 2, 5, 1];
      const atA = ref(A), atB = ref(B), atC = ref(C);
      frames.length = 0; gate.hold = false;
      const view = (v: number[], shown: boolean) => wrap(how, shown, chart(v));
      const { container, rerender } = render(view(A, true));
      act(() => { rerender(view(B, true)); });
      act(() => { step(3); });
      const mid = drawn(container);
      expect(mid).not.toBe(atA); expect(mid).not.toBe(atB);                 /* moving */
      if (how === 'activity') act(() => { rerender(view(B, false)); });
      else { gate.hold = true; act(() => { rerender(view(B, true)); }); }    /* the fallback shows; the chart is hidden */
      act(() => { step(2); });                                              /* frames while hidden move nothing */
      if (how === 'activity') act(() => { rerender(view(B, true)); });
      else { gate.hold = false; act(() => { gate.wake(); }); act(() => { rerender(view(B, true)); }); }
      expect(drawn(container)).toBe(atB);                                   /* at once, before any frame */
      act(() => { rerender(view(C, true)); });
      act(() => { step(3); });
      const next = drawn(container);
      expect(next).not.toBe(atB); expect(next).not.toBe(atC);               /* moves, not snaps */
      act(() => { settle(); });
      expect(drawn(container)).toBe(atC);
    });
  }
});
