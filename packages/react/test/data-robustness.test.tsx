/* Data the components must survive: empty and shrinking data, non-finite values, huge or sparse series, large
   selections, dates, and the viewer's index and items changing under it. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
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
    /* rendered in the frame itself, before anything after it (the browser's drawing of that frame) */
    act(() => {
      const run = frames; frames = []; run.forEach((f) => f(performance.now()));
      expect(container.querySelector('[data-r="100"]')).not.toBeNull();
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
