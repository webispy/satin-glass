/* Server rendering and hydration: the HTML a server writes, and the first render in the browser that hydrates it,
   must be the same tree with the same attributes (ids that wire labels, the theme, portals, charts, the calendar).
   The server half runs with the DOM globals removed and the modules loaded afresh, as on a server; the client half
   loads them again with the DOM back, in a browser that prefers dark, reduced motion and reduced transparency and
   whose clock (or time zone) says it is already the next day. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { act } from 'react';

type Lib = typeof import('../src');
const loadLib = () => import('../src');

/* what a server does not have; the setup file's stubs (ResizeObserver, matchMedia) go too */
const BROWSER_ONLY = ['window', 'self', 'top', 'parent', 'document', 'matchMedia', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'innerWidth', 'innerHeight', 'scrollX', 'scrollY',
  'addEventListener', 'removeEventListener', 'Element', 'HTMLElement', 'Node', 'Image', 'DOMRect', 'location', 'history', 'CSS'];

/* the server's clock and the browser's: 23:30 on 30 November there, 00:30 on 1 December here */
const SERVER_NOW = new Date(2026, 10, 30, 23, 30);
const CLIENT_NOW = new Date(2026, 11, 1, 0, 30);
type Clocks = { server: Date; client: Date };

async function onServer<T, M = Lib>(run: (lib: M, server: typeof import('react-dom/server')) => T, load: () => Promise<M> = loadLib as () => Promise<M>, now = SERVER_NOW): Promise<T> {
  const g = globalThis as Record<string, unknown>;
  const saved = new Map<string, PropertyDescriptor>();
  for (const k of BROWSER_ONLY) {
    const d = Object.getOwnPropertyDescriptor(g, k);
    if (d) { saved.set(k, d); delete g[k]; }
  }
  vi.useFakeTimers({ now, toFake: ['Date'] });
  try {
    expect(typeof window).toBe('undefined');
    vi.resetModules();
    const lib = await load();
    const server = await import('react-dom/server');
    return run(lib, server);
  } finally {
    vi.useRealTimers();
    for (const [k, d] of saved) Object.defineProperty(g, k, d);
    vi.resetModules();
  }
}

/* a browser that prefers dark, reduced motion and reduced transparency, and lays charts out 320 px wide */
const PREFERS = ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)', '(prefers-reduced-transparency: reduce)'];
const WIDTH = 320;
class MeasuringObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(el: Element) { queueMicrotask(() => this.cb([{ target: el, contentRect: { width: WIDTH } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)); }
  unobserve() {}
  disconnect() {}
}
function browserMedia() {
  const savedRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = MeasuringObserver as unknown as typeof ResizeObserver;
  const mm = (q: string) => ({ matches: PREFERS.includes(q), media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
  const saved = window.matchMedia;
  window.matchMedia = mm as unknown as typeof window.matchMedia;
  return () => { window.matchMedia = saved; globalThis.ResizeObserver = savedRO; };
}

type Tree<M = Lib> = (lib: M) => ReactElement;

/** Renders `tree` on the server, puts the HTML in the page and hydrates it; returns what React reported. `load`
    gives the modules the tree is built from (the whole library by default), on each side. */
async function hydrate<M = Lib>(tree: Tree<M>, { load = loadLib as () => Promise<M>, clocks = { server: SERVER_NOW, client: CLIENT_NOW } }: { load?: () => Promise<M>; clocks?: Clocks } = {}) {
  const html = await onServer((lib: M, server) => server.renderToString(tree(lib)), load, clocks.server);
  const restoreMedia = browserMedia();
  vi.useFakeTimers({ now: clocks.client, toFake: ['Date'] });
  const lib = await load();
  const { hydrateRoot } = await import('react-dom/client');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const recoverable: unknown[] = [];
  const errors: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errors.push(a.map(String).join(' ')); });
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, tree(lib), { onRecoverableError: (e) => { recoverable.push(e); } });
    });
    await act(async () => { await Promise.resolve(); });
  } finally {
    spy.mockRestore();
    vi.useRealTimers();
  }
  const cleanup = () => { act(() => root?.unmount()); container.remove(); restoreMedia(); };
  return { html, container, recoverable, errors, cleanup };
}

const OPTIONS = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }];
const DATA = [{ m: 'Jan', a: 3, b: 5 }, { m: 'Feb', a: 4, b: 2 }, { m: 'Mar', a: 6, b: 7 }];
const SERIES = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }];

/* one of every kind of entry: fields with their labels, the selection popups, dates, tabs, charts, an overlay open
   from the start and the toaster's portal, all under a ThemeProvider that follows the system */
const everything: Tree = (L) => createElement(L.ThemeProvider, { theme: L.createTheme() },
  createElement(L.Toaster, null,
    createElement(L.TextField, { label: 'Name', helperText: 'As on your passport' }),
    createElement(L.Checkbox, { label: 'Remember me' }),
    createElement(L.Select, { label: 'Fruit', options: OPTIONS }),
    createElement(L.Combobox, { label: 'Search fruit', options: OPTIONS }),
    createElement(L.Calendar, { 'aria-label': 'Day' }),
    createElement(L.Calendar, { defaultValue: new Date(2026, 4, 9) }),
    createElement(L.Calendar, { 'aria-label': 'November', defaultMonth: new Date(2026, 10, 1, 12) }),
    createElement(L.DatePicker, { label: 'Departure' }),
    createElement(L.Tabs, { 'aria-label': 'Sections', items: [{ value: 'one', label: 'One', content: 'First' }, { value: 'two', label: 'Two', content: 'Second' }] }),
    createElement(L.LineChart, { data: DATA, x: 'm', series: SERIES, area: true, 'aria-label': 'Trend' }),
    createElement(L.BarChart, { data: DATA, x: 'm', series: SERIES, 'aria-label': 'Totals' }),
    createElement(L.Sparkline, { values: [1, 3, 2, 5], 'aria-label': 'Recent' }),
    createElement(L.Meter, { value: 40, label: 'Storage' }),
    createElement(L.Dialog, { open: true, onClose: () => {}, title: 'Delete the file?' }, 'It cannot be restored.'),
  ));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.useRealTimers(); });

describe('server rendering', () => {
  it('writes the same HTML every time, with ids that wire labels and work in a CSS selector', async () => {
    const [a, b] = await onServer((L, S) => [S.renderToString(everything(L)), S.renderToString(everything(L))]);
    expect(a).toBe(b);
    const host = document.createElement('div');
    host.innerHTML = a;
    const refs = Array.from(host.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]'))
      .flatMap((el) => ['aria-labelledby', 'aria-describedby', 'aria-controls'].flatMap((a) => (el.getAttribute(a) ?? '').split(/\s+/).filter(Boolean)));
    expect(refs.length).toBeGreaterThan(3);
    for (const id of refs) expect(host.querySelector(`#${id}`), id).not.toBeNull();
  });
});

describe('hydration', () => {
  it('hydrates every kind of entry without a mismatch or an error', async () => {
    const h = await hydrate(everything);
    try {
      expect(h.recoverable.map(String)).toEqual([]);
      expect(h.errors).toEqual([]);
    } finally { h.cleanup(); }
  });

  it('shows the year list from the browser\'s today once known, centred on the given year, the server\'s clock being a year behind', async () => {
    /* the list runs a century back and twenty years on from today: 1926–2046 by the browser's clock (1925–2045 by the
       server's, which must not be drawn: the browser would hydrate another list). Centring the given year is the
       list's opening, so it happens on the list that is finally shown */
    const centred: string[] = [], at: number[] = [];
    const scroll = vi.spyOn(Element.prototype, 'scrollTop', 'set').mockImplementation(function (this: Element, v: number) {
      centred.push(this.querySelector('[role="option"]')?.textContent ?? ''); at.push(v);
    });
    /* jsdom lays nothing out: rows of three 40 px cells in a 300 px list */
    const geometry = {
      offsetTop: { get(this: HTMLElement) { return Math.floor(Number(this.dataset.i ?? 0) / 3) * 40; } },
      offsetHeight: { get(this: HTMLElement) { return this.getAttribute('role') === 'option' ? 40 : 0; } },
      clientHeight: { get(this: HTMLElement) { return this.getAttribute('role') === 'listbox' ? 300 : 0; } },
    };
    const saved = Object.fromEntries(Object.keys(geometry).map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)]));
    for (const [k, d] of Object.entries(geometry)) Object.defineProperty(HTMLElement.prototype, k, { configurable: true, ...d });
    try {
      const h = await hydrate((L) => createElement(L.Calendar, { openTo: 'year', defaultMonth: new Date(1980, 0, 1, 12) }),
        { clocks: { server: new Date(2025, 11, 31, 23, 30), client: new Date(2026, 0, 1, 0, 30) } });
      try {
        expect(h.recoverable.map(String)).toEqual([]);
        expect(h.errors).toEqual([]);
        expect(h.container.querySelector('[role="option"]')?.textContent).toBe('1926');
        expect(centred.at(-1)).toBe('1926');
        /* 1980 is the 55th year from 1926: row 18, 720 px down; centred in 300 px, the list scrolls to 720 - 130 */
        expect(at.at(-1)).toBe(590);
        /* the caption names the years in the 300 px window; the stand-in scroll position stays at the top */
        expect(h.container.querySelector('.sg-calendar__caption')?.textContent).toBe('1926 – 1946');
      } finally { h.cleanup(); }
    } finally {
      scroll.mockRestore();
      for (const [k, d] of Object.entries(saved)) if (d) Object.defineProperty(HTMLElement.prototype, k, d); else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    }
  });

  it("follows the system's dark mode, reduced motion and reduced transparency once hydrated", async () => {
    const h = await hydrate((L) => createElement(L.ThemeProvider, { theme: L.createTheme() }, createElement(L.Button, null, 'Go')));
    try {
      expect(h.html).toContain('data-sg-theme="light"');   /* the server cannot know */
      const el = h.container.querySelector<HTMLElement>('.sg-root')!;
      expect(el.dataset.sgTheme).toBe('dark');
      expect(el.dataset.sgReduceMotion).toBe('true');
      expect(el.classList.contains('sg-reduce-transparency')).toBe(true);
      expect(h.errors).toEqual([]);
    } finally { h.cleanup(); }
  });

  it('opens an overlay that was open on the server, and mounts the toaster, once hydrated', async () => {
    const h = await hydrate((L) => createElement(L.ThemeProvider, { theme: L.createTheme() },
      createElement(L.Toaster, null, createElement('p', null, 'Page'), createElement(L.Dialog, { open: true, onClose: () => {}, title: 'Delete the file?' }, 'It cannot be restored.'))));
    try {
      expect(h.recoverable.map(String)).toEqual([]);
      const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
      expect(dialog).not.toBeNull();
      expect(document.getElementById(dialog!.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete the file?');
      expect(dialog!.closest('.sg-portal')?.getAttribute('data-sg-theme')).toBe('dark');
      expect(document.body.querySelector('.sg-toaster')).not.toBeNull();
      expect(h.errors).toEqual([]);
    } finally { h.cleanup(); }
  });

  it('keeps a chart\'s entrance still while hydrating in a browser that reduces motion', async () => {
    /* the provider follows the system, which the server cannot know: the DonutChart enters in the hydration commit,
       before the provider has rendered with the system's setting */
    const moved: Keyframe[][] = [];
    const animate = Element.prototype.animate;
    const spy = vi.spyOn(Element.prototype, 'animate').mockImplementation(function (this: Element, k, o) {
      if (Array.isArray(k) && k.some((f) => 'transform' in f)) moved.push(k);
      return animate.call(this, k, o);
    });
    try {
      const h = await hydrate((L) => createElement(L.ThemeProvider, { theme: L.createTheme() },
        createElement(L.DonutChart, { data: [{ label: 'A', value: 2 }, { label: 'B', value: 3 }], 'aria-label': 'Share' })));
      try {
        expect(h.recoverable.map(String)).toEqual([]);
        expect(h.errors).toEqual([]);
        expect(moved).toEqual([]);
        expect(h.html).toContain('data-sg-reduce-motion="system"');   /* neither on nor off: the browser's own */
        expect(h.container.querySelector<HTMLElement>('.sg-root')!.dataset.sgReduceMotion).toBe('true');
      } finally { h.cleanup(); }
    } finally { spy.mockRestore(); }
  });

  it('draws the charts at their measured width once hydrated', async () => {
    const h = await hydrate((L) => createElement('div', null,
      createElement(L.LineChart, { data: DATA, x: 'm', series: SERIES, area: true, 'aria-label': 'Trend' }),
      createElement(L.BarChart, { data: DATA, x: 'm', series: SERIES, 'aria-label': 'Totals' }),
      createElement(L.Sparkline, { values: [1, 3, 2, 5], 'aria-label': 'Recent' })));
    try {
      expect(h.recoverable.map(String)).toEqual([]);
      expect(h.errors).toEqual([]);
      expect(h.container.querySelectorAll(`svg[width="${WIDTH}"]`).length).toBe(3);
    } finally { h.cleanup(); }
  });

  it("marks the browser's today once hydrated, not the server's", async () => {
    /* without a month given, and with November given (whose grid shows both the server's and the browser's day) */
    const h = await hydrate((L) => createElement('div', null, createElement(L.Calendar, { 'aria-label': 'Day' }),
      createElement(L.Calendar, { 'aria-label': 'November', defaultMonth: new Date(2026, 10, 1, 12) })));
    try {
      expect(h.recoverable.map(String)).toEqual([]);
      expect(h.errors).toEqual([]);
      const marked = Array.from(h.container.querySelectorAll<HTMLElement>('[aria-current="date"]'), (b) => b.dataset.date);
      expect(marked).toEqual(['2026-12-01', '2026-12-01']);
      expect(h.container.querySelectorAll('h2')[1].textContent).toBe('November 2026');
    } finally { h.cleanup(); }
  });
});


describe('today', () => {
  it('moves on at midnight while the calendar is shown', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 30, 23, 59, 30) });
    const { Calendar } = await import('../src');
    const { render, act: tlAct } = await import('@testing-library/react');
    const { container, unmount } = render(createElement(Calendar, { 'aria-label': 'Day' }));
    const marked = () => container.querySelector<HTMLElement>('[aria-current="date"]')?.dataset.date;
    expect(marked()).toBe('2026-11-30');
    tlAct(() => { vi.advanceTimersByTime(60_000); });
    expect(marked()).toBe('2026-12-01');
    expect(container.querySelector('h2')?.textContent).toBe('November 2026');   /* the month shown stays */
    unmount();
  });
});

describe('ids', () => {
  it('are the same for the same tree, and stay apart under prefixes that differ only in punctuation', async () => {
    const { TextField } = await import('../src');
    const { renderToString } = await import('react-dom/server');
    const ids = (prefix: string) => renderToString(createElement(TextField, { label: 'Name' }), { identifierPrefix: prefix }).match(/ id="([^"]+)"/)![1];
    for (const [a, b] of [['widget:one-', 'widgetone-'], ['sales.eu', 'saleseu'], ['a_b', 'a_5f_b']]) {
      const x = ids(a), y = ids(b);
      /* a server renders a page many times, and the browser hydrating one of them must find the same ids */
      expect(ids(a)).toBe(x);
      expect(ids(b)).toBe(y);
      expect(x).not.toBe(y);
      for (const id of [x, y]) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('year picker', () => {
  /* opens the year list a moment before New Year, moves the keyboard with `keys`, and lets midnight pass */
  async function atNewYear(keys: string[], props: Record<string, unknown> = {}) {
    Element.prototype.scrollIntoView ??= () => {};   /* jsdom has none */
    vi.useFakeTimers({ now: new Date(2025, 11, 31, 23, 59, 30) });
    const { Calendar } = await import('../src');
    const { render, act: tlAct, fireEvent } = await import('@testing-library/react');
    const view = render(createElement(Calendar, { 'aria-label': 'Day', openTo: 'year', ...props }));
    const list = () => view.container.querySelector<HTMLElement>('[role="listbox"]')!;
    for (const key of keys) fireEvent.keyDown(list(), { key });
    const before = (document.activeElement as HTMLElement).textContent;
    expect(list().querySelector('[role="option"]')?.textContent).toBe('1925');
    /* the list is not centred again on the chosen year: nothing sets its scroll position */
    let recentred = false;
    Object.defineProperty(list(), 'scrollTop', { configurable: true, get: () => 0, set: () => { recentred = true; } });
    const shown = vi.spyOn(Element.prototype, 'scrollIntoView');
    tlAct(() => { vi.advanceTimersByTime(60_000); });   /* 2026 now: the list runs 1926–2046 */
    expect(list().querySelector('[role="option"]')?.textContent).toBe('1926');
    expect(recentred).toBe(false);
    const focused = document.activeElement as HTMLElement;
    expect(shown.mock.contexts).toContain(focused);   /* kept in sight */
    shown.mockRestore();
    return { before, focused, list, fireEvent, view };
  }

  it('keeps the keyboard and focus on the focused year when New Year moves the list', async () => {
    const { before, focused, list, fireEvent, view } = await atNewYear(['ArrowLeft']);   /* 2025 → 2024 */
    expect(before).toBe('2024');
    expect(focused.textContent).toBe('2024');
    expect(focused.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(list(), { key: 'Enter' });
    expect(view.container.querySelector('.sg-calendar__caption')?.textContent).toBe('2024');   /* the months of 2024 */
    view.unmount();
  });

  it('Enter picks the focused year when the chosen year leaves the list', async () => {
    /* the chosen year is the oldest: at New Year it leaves, and the chosen cell falls back to 1926 */
    const { focused, list, fireEvent, view } = await atNewYear(['ArrowDown', 'ArrowRight', 'ArrowRight'], { defaultMonth: new Date(1925, 5, 1, 12) });   /* 1925 → 1930 */
    expect(focused.textContent).toBe('1930');
    expect(focused.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(list(), { key: 'Enter' });
    expect(view.container.querySelector('.sg-calendar__caption')?.textContent).toBe('1930');
    view.unmount();
  });

  it('moves focus to the nearest year shown when the focused year leaves the list', async () => {
    const { before, focused, list, view } = await atNewYear(['1', '9', '2', '5']);   /* type-ahead to the oldest year */
    expect(before).toBe('1925');
    expect(focused.textContent).toBe('1926');
    expect(list().contains(focused)).toBe(true);
    expect(focused.getAttribute('tabindex')).toBe('0');
    view.unmount();
  });
});

/* Node reads TZ again whenever it is set */
declare const process: { env: Record<string, string | undefined> };

describe('today across time zones', () => {
  it('moves on at the new zone\'s midnight after the zone changes', async () => {
    const zone = process.env.TZ;
    process.env.TZ = 'UTC';
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 30, 12) });
    try {
      const { Calendar } = await import('../src');
      const { render, act: tlAct } = await import('@testing-library/react');
      const { container, unmount } = render(createElement(Calendar, { 'aria-label': 'Day' }));
      const marked = () => container.querySelector<HTMLElement>('[aria-current="date"]')?.dataset.date;
      expect(marked()).toBe('2026-11-30');
      process.env.TZ = 'Asia/Seoul';   /* 21:00 on 30 November there; midnight is 15:00 UTC */
      tlAct(() => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(marked()).toBe('2026-11-30');
      tlAct(() => { vi.advanceTimersByTime(3 * 3600_000 + 5_000); });
      expect(marked()).toBe('2026-12-01');
      unmount();
    } finally {
      if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone;
    }
  });

  it('marks and names the days by the new zone when the zone changes on the same day', async () => {
    const zone = process.env.TZ;
    /* 00:30 on 30 November in Honolulu, and 23:30 on the 30th in Auckland: the day is the same in both */
    process.env.TZ = 'Pacific/Honolulu';
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 30, 10, 30) });
    try {
      const { Calendar } = await import('../src');
      const { render, act: tlAct } = await import('@testing-library/react');
      /* a chosen instant shows as its day in the zone in force: noon on the 15th in Honolulu is the 16th in Auckland */
      const chosen = new Date(Date.UTC(2026, 10, 15, 22));
      const el = (name: string) => createElement('div', null, createElement(Calendar, { 'aria-label': name }),
        createElement(Calendar, { 'aria-label': `${name}, months`, openTo: 'month', defaultMonth: new Date(2026, 10, 1, 12) }),
        createElement('div', { className: 'chosen' }, createElement(Calendar, { 'aria-label': `${name}, chosen`, value: chosen })));
      const { container, unmount } = render(el('Day'));
      const marked = () => container.querySelector<HTMLElement>('[aria-current="date"]')?.dataset.date;
      expect(marked()).toBe('2026-11-30');
      const selected = () => container.querySelector<HTMLElement>('.chosen [aria-pressed="true"][data-date]')?.dataset.date;
      expect(selected()).toBe('2026-11-15');
      process.env.TZ = 'Pacific/Auckland';
      /* the event alone renders the calendar again: the zone is part of what it reads */
      tlAct(() => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(selected()).toBe('2026-11-16');   /* only a render after the event shows this */
      expect(marked()).toBe('2026-11-30');
      const name = container.querySelector<HTMLElement>('[data-date="2026-11-30"]')?.textContent ?? '';
      expect(name).toContain('November 30, 2026');
      expect(container.querySelector('h2')?.textContent).toBe('November 2026');
      expect(container.querySelector('[role="option"][data-current]')?.textContent).toBe('November');   /* this month's ring */
      unmount();
    } finally {
      if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone;
    }
  });
});

/* each public entry point (`@satin-glass/react/<category>`), with a ThemeProvider from the foundation entry: rendered
   on a server and hydrated, as an app importing only that entry would */
type Entries = { F: typeof import('../src/entries/foundation'); E: Record<string, unknown> };
const C = (E: Record<string, unknown>, name: string) => E[name] as ComponentType<Record<string, unknown>>;
const ENTRIES: Record<string, [() => Promise<Record<string, unknown>>, (E: Record<string, unknown>) => ReactElement[]]> = {
  foundation: [() => import('../src/entries/foundation'), (E) => [createElement(C(E, 'Glass'), { key: 1 }, createElement(C(E, 'Text'), null, 'Hello'))]],
  controls: [() => import('../src/entries/controls'), (E) => [createElement(C(E, 'TextField'), { key: 1, label: 'Name', helperText: 'As on your passport' }), createElement(C(E, 'Switch'), { key: 2, label: 'Wi-Fi' })]],
  layout: [() => import('../src/entries/layout'), (E) => [createElement(C(E, 'Accordion'), { key: 1, items: [{ value: 'a', title: 'Shipping', content: 'Two days' }] }),
    createElement(C(E, 'Card'), { key: 2 }, createElement(C(E, 'CardBody'), null, 'Body'))]],
  navigation: [() => import('../src/entries/navigation'), (E) => [createElement(C(E, 'Tabs'), { key: 1, 'aria-label': 'Sections', items: [{ value: 'one', label: 'One', content: 'First' }, { value: 'two', label: 'Two', content: 'Second' }] }),
    createElement(C(E, 'Pagination'), { key: 2, page: 2, pageCount: 9, onChange: () => {} })]],
  selection: [() => import('../src/entries/selection'), (E) => [createElement(C(E, 'Select'), { key: 1, label: 'Fruit', options: OPTIONS }), createElement(C(E, 'Checkbox'), { key: 2, label: 'Remember me' }),
    createElement(C(E, 'Calendar'), { key: 3, 'aria-label': 'Day' })]],
  overlays: [() => import('../src/entries/overlays'), (E) => [createElement(C(E, 'Toaster'), { key: 1 }, createElement(C(E, 'Dialog'), { open: true, onClose: () => {}, title: 'Delete the file?' }, 'It cannot be restored.'),
    createElement(C(E, 'Tooltip'), { content: 'More about this' }, createElement('button', { type: 'button' }, 'Help')))]],
  feedback: [() => import('../src/entries/feedback'), (E) => [createElement(C(E, 'Banner'), { key: 1, title: 'Saved' }, 'Your changes are kept.'),
    createElement(C(E, 'EmptyState'), { key: 2, title: 'No orders yet' }), createElement(C(E, 'Tag'), { key: 3, tone: 'success' }, 'Paid')]],
  data: [() => import('../src/entries/data'), (E) => [createElement(C(E, 'LineChart'), { key: 1, data: DATA, x: 'm', series: SERIES, 'aria-label': 'Trend' }),
    createElement(C(E, 'DonutChart'), { key: 2, data: [{ label: 'A', value: 2 }, { label: 'B', value: 3 }], 'aria-label': 'Share' }), createElement(C(E, 'Meter'), { key: 3, value: 40, label: 'Storage' })]],
};

describe('each entry point', () => {
  it.each(Object.keys(ENTRIES))('%s renders on a server and hydrates without a mismatch or an error', async (name) => {
    const [load, parts] = ENTRIES[name];
    const h = await hydrate<Entries>(({ F, E }) => createElement(F.ThemeProvider, { theme: F.createTheme() }, ...parts(E)),
      { load: async () => ({ F: await import('../src/entries/foundation'), E: await load() }) });
    try {
      expect(h.html.length).toBeGreaterThan(100);
      expect(h.recoverable.map(String)).toEqual([]);
      expect(h.errors).toEqual([]);
    } finally { h.cleanup(); }
  });
});
