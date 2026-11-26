import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { StrictMode, Suspense, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { topLayerCount } from '@satin-glass/core';
import { Button, Dialog, Menu, MenuItem, Popover, ActionSheet, Sheet, Drawer, ContextMenu, Toaster, useToast, ThemeProvider, createTheme, MediaViewer } from '../src';

/* jsdom lays nothing out: offsetParent is always null and getClientRects empty. Stand in for layout so focus traps
   see their stops and anchors count as shown; an element under display: none has neither. */
const hidden = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) if ((e as HTMLElement).style?.display === 'none') return true; return !el.isConnected; };
const saved = { op: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent'), rects: Element.prototype.getClientRects, ro: globalThis.ResizeObserver };
const observers: { cb: ResizeObserverCallback; els: Element[] }[] = [];
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get(this: HTMLElement) { return hidden(this) ? null : this.parentElement; } });
  Element.prototype.getClientRects = function (this: Element) { return (hidden(this) ? [] : [new DOMRect(0, 0, 10, 10)]) as unknown as DOMRectList; };
  globalThis.ResizeObserver = class {
    o: { cb: ResizeObserverCallback; els: Element[] };
    constructor(cb: ResizeObserverCallback) { this.o = { cb, els: [] }; observers.push(this.o); }
    observe(el: Element) { this.o.els.push(el); }
    unobserve() {}
    disconnect() { this.o.els = []; }
  } as unknown as typeof ResizeObserver;
});
afterAll(() => {
  if (saved.op) Object.defineProperty(HTMLElement.prototype, 'offsetParent', saved.op); else delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
  Element.prototype.getClientRects = saved.rects; globalThis.ResizeObserver = saved.ro;
});
const resized = (el: Element) => act(() => { for (const o of observers) if (o.els.includes(el)) o.cb([], {} as ResizeObserver); });
/* exits (and entrances) that never finish, so a test can look at a panel while it is still folding away */
const holdAnimations = () => vi.spyOn(Element.prototype, 'animate').mockImplementation(() => ({ finished: new Promise(() => {}), cancel() {}, finish() {}, onfinish: null }) as unknown as Animation);
afterEach(() => { vi.restoreAllMocks(); });   /* also when a test fails before letting go */
const tab = (shiftKey = false) => { const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(e); return e; };

describe('nested overlays', () => {
  it('a press in a list opened from a popover does not close the popover', async () => {
    const closePopover = vi.fn(), pick = vi.fn();
    function T() {
      const a = useRef<HTMLButtonElement>(null), b = useRef<HTMLButtonElement>(null);
      const [, force] = useState(0); const [menu, setMenu] = useState(false);
      return (<>
        <button ref={a} onClick={() => force(1)}>anchor</button>
        <Popover open onClose={closePopover} anchor={a.current} aria-label="filters">
          <button ref={b} onClick={() => setMenu(true)}>sort</button>
          <Menu open={menu} onClose={() => setMenu(false)} anchor={b.current} aria-label="sort by"><MenuItem onSelect={pick}>name</MenuItem></Menu>
        </Popover>
      </>);
    }
    render(<T />);
    fireEvent.click(screen.getByText('anchor'));
    fireEvent.click(await screen.findByText('sort'));
    const item = await screen.findByRole('menuitem', { name: 'name' });
    fireEvent.pointerDown(item); fireEvent.click(item);
    expect(pick).toHaveBeenCalled();
    expect(closePopover).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);   /* a press on the page still closes it */
    expect(closePopover).toHaveBeenCalledWith('backdrop');
  });

  it('a dialog opened by a menu item gives focus back to the menu\'s button once the menu has gone', async () => {
    function T() {
      const ref = useRef<HTMLButtonElement>(null);
      const [menu, setMenu] = useState(false), [dialog, setDialog] = useState(false);
      return (<>
        <button ref={ref} onClick={() => setMenu(true)}>more</button>
        <Menu open={menu} onClose={() => setMenu(false)} anchor={ref.current} aria-label="actions"><MenuItem onSelect={() => setDialog(true)}>delete</MenuItem></Menu>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="Delete?" actions={<Button>OK</Button>} />
      </>);
    }
    render(<T />);
    const more = screen.getByText('more');
    more.focus(); fireEvent.click(more);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'delete' }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true);
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(more);
  });

  it('the same from an action sheet row', async () => {
    function T() {
      const [sheet, setSheet] = useState(false), [dialog, setDialog] = useState(false);
      return (<>
        <button onClick={() => setSheet(true)}>share</button>
        <ActionSheet open={sheet} onClose={() => setSheet(false)} aria-label="share" actions={[{ label: 'remove', onSelect: () => setDialog(true) }]} />
        <Dialog open={dialog} onClose={() => setDialog(false)} title="Remove?" actions={<Button>OK</Button>} />
      </>);
    }
    render(<T />);
    const share = screen.getByText('share');
    share.focus(); fireEvent.click(share);
    const row = await screen.findByText('remove');
    row.closest('button')!.focus(); fireEvent.click(row);
    await waitFor(() => expect(screen.queryByText('remove')).toBeNull());
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(share);
  });

  it('Tab from a popover\'s last control in a dialog moves on inside the dialog, and the popover closes', async () => {
    const closed = vi.fn();
    function T() {
      const a = useRef<HTMLButtonElement>(null); const [pop, setPop] = useState(false);
      return (
        <Dialog open onClose={() => {}} title="Edit" actions={<><button ref={a} onClick={() => setPop(true)}>options</button><button>save</button></>}>
          <Popover open={pop} onClose={(r) => { closed(r); setPop(false); }} anchor={a.current} aria-label="options"><button>one</button><button>two</button></Popover>
        </Dialog>
      );
    }
    render(<T />);
    const options = screen.getByText('options');
    options.focus(); fireEvent.click(options);
    await screen.findByText('two');
    expect(document.activeElement?.textContent).toBe('one');
    screen.getByText('two').focus();
    const e = tab();
    expect(e.defaultPrevented).toBe(true);
    expect(closed).toHaveBeenCalledWith('backdrop');
    expect(document.activeElement?.textContent).toBe('save');
    /* Shift+Tab from the first control goes back to the button that opened it */
    await waitFor(() => expect(screen.queryByText('two')).toBeNull());
    options.focus(); fireEvent.click(options);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('one'));
    tab(true);
    expect(document.activeElement).toBe(options);
  });
});

describe('Escape calls the latest onClose', () => {
  it.each(['dialog', 'action sheet'])('%s', (kind) => {
    const first = vi.fn(), latest = vi.fn();
    const el = (onClose: () => void) => kind === 'dialog'
      ? <Dialog open onClose={onClose} title="t" />
      : <ActionSheet open onClose={onClose} aria-label="t" actions={[{ label: 'a' }]} />;
    const { rerender, unmount } = render(el(first));
    rerender(el(latest));
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith('escape');
    unmount();
  });
});

describe('anchored panel and its anchor', () => {
  /* a scroll is read in its event and the panel placed in the frame after it, before that frame is drawn */
  const scrolled = async () => { fireEvent.scroll(document); await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(undefined))); }); };
  /* a page scrolled 500 px; the anchor's box in the view is given by `at` */
  async function opened(wrap: 'fixed' | 'sticky' | 'sticky-in-area' | 'none', at: { y: number }) {
    const sy = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
    const done = () => { if (sy) Object.defineProperty(window, 'scrollY', sy); };
    function R() {
      const a = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      const btn = <button ref={a} onClick={() => setOpen(true)}>contents</button>;
      return (<>
        {wrap === 'none' ? btn
          : wrap === 'sticky-in-area' ? <div style={{ overflow: 'auto' }}><div style={{ position: 'sticky' }}>{btn}</div></div>
            : <div style={{ position: wrap }}>{btn}</div>}
        <Popover open={open} onClose={() => {}} anchor={a.current} aria-label="p" placement="bottom-start"><button>in</button></Popover>
      </>);
    }
    render(<R />);
    const anchor = screen.getByText('contents');
    anchor.getBoundingClientRect = () => new DOMRect(16, at.y, 200, 40);
    fireEvent.click(anchor);
    const panel = await screen.findByRole('dialog', { name: 'p' });
    return { panel, done };
  }
  it('stays with an anchor in a fixed bar when the page scrolls under it', async () => {
    const at = { y: 12 };
    const { panel, done } = await opened('fixed', at);
    try {
      expect(panel.style.position).toBe('fixed');
      expect(panel.style.top).toBe('60px');   /* the view's coordinates: 12 + 40 + 8, not 500 more */
      await scrolled();
      expect(panel.style.top).toBe('60px');
    } finally { done(); }
  });
  it('a menu opened from a popover stays with its button when one scroll moves the popover', async () => {
    function T() {
      const a = useRef<HTMLButtonElement>(null), b = useRef<HTMLButtonElement>(null);
      const [, force] = useState(0); const [menu, setMenu] = useState(false);
      return (<>
        <button ref={a} onClick={() => force(1)}>anchor</button>
        <Popover open onClose={() => {}} anchor={a.current} aria-label="filters" placement="bottom-start">
          <button ref={b} onClick={() => setMenu(true)}>sort</button>
          <Menu open={menu} onClose={() => setMenu(false)} anchor={b.current} aria-label="sort by"><MenuItem onSelect={() => {}}>name</MenuItem></Menu>
        </Popover>
      </>);
    }
    render(<T />);
    const anchor = screen.getByText('anchor'); let ay = 100;
    anchor.getBoundingClientRect = () => new DOMRect(16, ay, 200, 40);
    fireEvent.click(anchor);
    const pop = await screen.findByRole('dialog', { name: 'filters' });
    const sort = await screen.findByText('sort');
    /* the button is where the popover is drawn */
    sort.getBoundingClientRect = () => new DOMRect(parseFloat(pop.style.left) + 8, parseFloat(pop.style.top) - window.scrollY + 8, 80, 30);
    fireEvent.click(sort);
    const menu = await screen.findByRole('menu', { name: 'sort by' });
    const gap = () => parseFloat(menu.style.top) - parseFloat(pop.style.top);
    const top0 = parseFloat(pop.style.top), g0 = gap();
    ay = 40; await scrolled();   /* the area scrolled 60 px: the popover moves, and the menu with its button */
    expect(parseFloat(pop.style.top)).toBe(top0 - 60);
    expect(gap()).toBe(g0);
  });
  it('follows a sticky anchor that the page still carries, until it sticks', async () => {
    const at = { y: 112 };
    const { panel, done } = await opened('sticky', at);
    try {
      expect(panel.style.position).toBe('fixed');
      expect(panel.style.top).toBe('160px');
      at.y = 12; fireEvent.scroll(document);   /* scrolled 100 px: the bar moved up with the page and stuck */
      expect(panel.style.top).toBe('160px');   /* not written in the scroll event (#57)... */
      await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(undefined))); });
      expect(panel.style.top).toBe('60px');   /* ...but in the frame after it */
      await scrolled();   /* stuck: the page goes on scrolling, the bar and the panel stay */
      expect(panel.style.top).toBe('60px');
    } finally { done(); }
  });
  it('takes the anchor\'s own box, not the one its press shrinks (an iOS tap opens it while still pressed)', async () => {
    const at = { y: 12 };
    const { panel, done } = await opened('fixed', at);
    try {
      const anchor = screen.getByText('contents');
      /* opened again while pressed: scaled 0.965 about its centre, 3.5 px narrower on each side */
      anchor.style.transform = 'matrix(0.965, 0, 0, 0.965, 0, 0)';   /* as a browser computes scale(0.965) */
      anchor.getBoundingClientRect = () => new DOMRect(19.5, 12.7, 193, 38.6);
      fireEvent(window, new Event('resize'));
      expect(panel.style.left).toBe('16px'); expect(panel.style.top).toBe('60px');
      anchor.style.transform = ''; anchor.getBoundingClientRect = () => new DOMRect(16, 12, 200, 40);   /* let go */
      await scrolled();
      expect(panel.style.left).toBe('16px'); expect(panel.style.top).toBe('60px');
    } finally { done(); }
  });
  it('measures where the view\'s frame starts (a transformed ancestor, a zoomed-in view)', async () => {
    const real = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.style.position === 'fixed' && this.tagName === 'SPAN' ? new DOMRect(0, -440, 0, 0) : real.call(this);
    });
    const { panel, done } = await opened('fixed', { y: 12 });
    try { expect(panel.style.top).toBe('500px'); }   /* 60 in the view, from a frame starting 440 above it */
    finally { done(); }
  });
  it('decides the frame again on resize (a breakpoint makes the bar sticky)', async () => {
    const at = { y: 112 };
    const { panel, done } = await opened('none', at);
    try {
      expect(panel.style.position).toBe('');
      (screen.getByText('contents').parentElement as HTMLElement).style.position = 'sticky';
      fireEvent(window, new Event('resize'));
      expect(panel.style.position).toBe('fixed');
      expect(panel.style.top).toBe('160px');
    } finally { done(); }
  });
  it('clips a panel again when it changes size after a scroll clipped it', async () => {
    function R() {
      const a = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<><div data-testid="area" style={{ overflow: 'auto' }}><button ref={a} onClick={() => setOpen(true)}>field</button></div>
        <Popover open={open} onClose={() => {}} anchor={a.current} aria-label="p" placement="bottom-start"><button>in</button></Popover></>);
    }
    render(<R />);
    const area = screen.getByTestId('area'), btn = screen.getByText('field');
    let y = 12; btn.getBoundingClientRect = () => new DOMRect(16, y, 200, 40);
    area.getBoundingClientRect = () => new DOMRect(0, 0, 400, 300);
    fireEvent.click(btn);
    const panel = await screen.findByRole('dialog', { name: 'p' });
    let h = 40; Object.defineProperty(panel, 'offsetHeight', { configurable: true, get: () => h });
    Object.defineProperty(panel, 'offsetWidth', { configurable: true, get: () => 200 });
    resized(panel);   /* measured at 40 px */
    y = -100; await scrolled();   /* the field went 112 px up: the 40 px panel (at 60 → -52) is wholly above the area */
    expect(panel.style.visibility).toBe('hidden');
    h = 100; resized(panel);   /* it grew (a list filtered as one types): 48 px of it shows again */
    expect(panel.style.visibility).toBe('');
    expect(panel.style.clipPath).toMatch(/^inset\(52px 0px 0px/);
  });
  it('keeps the edge that meets the anchor when the panel changes size (right to left, below)', async () => {
    function R() {
      const a = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<><button ref={a} style={{ direction: 'rtl' }} onClick={() => setOpen(true)}>field</button>
        <Popover open={open} onClose={() => {}} anchor={a.current} aria-label="p" placement="bottom-start"><button>in</button></Popover></>);
    }
    render(<R />);
    const btn = screen.getByText('field');
    btn.getBoundingClientRect = () => new DOMRect(500, 100, 200, 40);
    fireEvent.click(btn);
    const panel = await screen.findByRole('dialog', { name: 'p' });
    let w = 120; Object.defineProperty(panel, 'offsetWidth', { configurable: true, get: () => w });
    Object.defineProperty(panel, 'offsetHeight', { configurable: true, get: () => 80 });
    resized(panel);   /* measured at 120 px */
    const right = () => parseFloat(panel.style.left) + w;
    const r0 = right();
    w = 240; resized(panel);   /* wider results: it grows towards the end, leftwards */
    expect(right()).toBe(r0);
  });
  it('a panel growing past the view\'s edge stops at its padding while the anchor is in view', async () => {
    function R() {
      const a = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<><button ref={a} style={{ direction: 'rtl' }} onClick={() => setOpen(true)}>field</button>
        <Popover open={open} onClose={() => {}} anchor={a.current} aria-label="p" placement="bottom-start"><button>in</button></Popover></>);
    }
    render(<R />);
    const btn = screen.getByText('field');
    let at = new DOMRect(50, 100, 200, 40);   /* its right edge, the start, at x = 250 */
    btn.getBoundingClientRect = () => at;
    fireEvent.click(btn);
    const panel = await screen.findByRole('dialog', { name: 'p' });
    let w = 220; Object.defineProperty(panel, 'offsetWidth', { configurable: true, get: () => w });
    Object.defineProperty(panel, 'offsetHeight', { configurable: true, get: () => 80 });
    resized(panel);
    expect(parseFloat(panel.style.left)).toBe(30);
    w = 320; resized(panel);   /* would start at x = -70 */
    expect(parseFloat(panel.style.left)).toBe(12);
    /* an anchor scrolled out of the view: the panel moves with it, unclamped */
    at = new DOMRect(50, -300, 200, 40);
    w = 400; resized(panel);
    expect(parseFloat(panel.style.left)).toBe(12 - 80);
  });
  it('does not clip the panel of a fixed bar by a scroll area the bar escapes', async () => {
    function R() {
      const a = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<><div data-testid="area" style={{ overflow: 'auto' }}><div style={{ position: 'fixed' }}><button ref={a} onClick={() => setOpen(true)}>bar</button></div></div>
        <Popover open={open} onClose={() => {}} anchor={a.current} aria-label="p" placement="bottom-start"><button>in</button></Popover></>);
    }
    render(<R />);
    const area = screen.getByTestId('area'), btn = screen.getByText('bar');
    btn.getBoundingClientRect = () => new DOMRect(16, 12, 200, 40);
    area.getBoundingClientRect = () => new DOMRect(0, 0, 400, 300);
    fireEvent.click(btn);
    const panel = await screen.findByRole('dialog', { name: 'p' });
    area.getBoundingClientRect = () => new DOMRect(0, -900, 400, 300);   /* the page scrolled the area away */
    await scrolled();
    expect(panel.style.visibility).toBe(''); expect(panel.style.clipPath).toBe('');
  });
  it('keeps document coordinates for an anchor the page carries (and a bar sticky inside a scroll area)', async () => {
    for (const wrap of ['none', 'sticky-in-area'] as const) {
      const { panel, done } = await opened(wrap, { y: 112 });
      try {
        expect(panel.style.position).toBe('');
        expect(panel.style.top).toBe('660px');   /* 112 + 40 + 8 + the page's 500 */
      } finally { done(); cleanup(); }
    }
  });
  function T({ onClose, show = true, other = false }: { onClose: (r: string) => void; show?: boolean; other?: boolean }) {
    const a = useRef<HTMLButtonElement>(null), b = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    return (<>
      <button ref={a} style={{ display: show ? undefined : 'none' }} onClick={() => setOpen(true)}>anchor</button>
      <button ref={b}>other</button>
      <Menu open={open} onClose={onClose} anchor={other ? b.current : a.current} aria-label="m"><MenuItem>x</MenuItem></Menu>
    </>);
  }
  it('closes with \'anchor\' when the anchor is hidden without a scroll or resize', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<T onClose={onClose} />);
    fireEvent.click(screen.getByText('anchor'));
    await screen.findByRole('menu');
    const anchor = screen.getByText('anchor');
    resized(anchor); expect(onClose).not.toHaveBeenCalled();   /* still laid out */
    rerender(<T onClose={onClose} show={false} />);
    resized(anchor);
    expect(onClose).toHaveBeenCalledWith('anchor');
  });
  it('closes with \'anchor\' when the anchor is removed while the anchor option stays the same', async () => {
    const onClose = vi.fn();
    function R({ show }: { show: boolean }) {
      const [anchor, setAnchor] = useState<HTMLElement | null>(null);
      return (<div data-testid="bar">{show && <button onClick={(e) => setAnchor(e.currentTarget)}>more</button>}
        <Menu open={anchor !== null} onClose={onClose} anchor={anchor} aria-label="m"><MenuItem>x</MenuItem></Menu></div>);
    }
    const { rerender } = render(<R show />);
    fireEvent.click(screen.getByText('more'));
    await screen.findByRole('menu');
    rerender(<R show={false} />);   /* the same element in the option, gone from the page */
    expect(onClose).not.toHaveBeenCalled();
    resized(screen.getByTestId('bar'));
    expect(onClose).toHaveBeenCalledWith('anchor');
  });
  it('is placed against an element anchor that arrives after it opened (a ref still null at first)', async () => {
    const onClose = vi.fn();
    function R() {
      const a = useRef<HTMLButtonElement>(null); const [, force] = useState(0);
      return (<><button ref={a} onClick={() => force((n) => n + 1)}>anchor</button>
        <Popover open onClose={onClose} anchor={a.current} aria-label="p"><button>in</button></Popover></>);
    }
    render(<R />);
    const panel = await screen.findByRole('dialog', { name: 'p' });
    expect(panel.style.left).toBe(`${innerWidth / 2}px`);   /* no anchor yet: the middle of the window */
    const anchor = screen.getByText('anchor');
    anchor.getBoundingClientRect = () => new DOMRect(300, 200, 40, 20);
    fireEvent.click(anchor);
    expect(panel.style.left).toBe('320px'); expect(panel.style.top).toBe('228px');
    fireEvent.pointerDown(anchor);   /* now its anchor: a press on it is not outside */
    expect(onClose).not.toHaveBeenCalled();
  });
  it('is placed again when a DOMRect anchor moves, not when it is replaced by one at the same place', async () => {
    const onClose = vi.fn();
    const el = (r: DOMRect) => <Popover open onClose={onClose} anchor={r} aria-label="p"><button>in</button></Popover>;
    const { rerender } = render(el(new DOMRect(100, 100, 0, 0)));
    const panel = await screen.findByRole('dialog', { name: 'p' });
    expect(panel.style.left).toBe('100px');
    panel.style.left = '101px';   /* a mark: a placement again would overwrite it */
    rerender(el(new DOMRect(100, 100, 0, 0)));
    expect(panel.style.left).toBe('101px');
    rerender(el(new DOMRect(300, 300, 0, 0)));
    expect(panel.style.left).toBe('300px');
    expect(onClose).not.toHaveBeenCalled();
  });
  it('closes with \'anchor\' when the anchor option points somewhere else', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<T onClose={onClose} />);
    fireEvent.click(screen.getByText('anchor'));
    await screen.findByRole('menu');
    rerender(<T onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    rerender(<T onClose={onClose} other />);
    expect(onClose).toHaveBeenCalledWith('anchor');
  });
});

describe('a cancelled swipe springs back', () => {
  const swipe = (el: Element, axis: 'x' | 'y', sign = 1) => {
    const at = (d: number) => ({ pointerId: 7, button: 0, pointerType: 'touch', clientX: 100 + (axis === 'x' ? sign * d : 0), clientY: 100 + (axis === 'y' ? sign * d : 0) });
    fireEvent.pointerDown(el, at(0));
    for (const d of [20, 120, 400]) fireEvent.pointerMove(window, at(d));
    fireEvent.pointerCancel(window, at(400));
  };
  it('sheet', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="s">body</Sheet>);
    swipe(screen.getByText('s'), 'y');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').style.transform).toBe('');
  });
  it('drawer', () => {
    const onClose = vi.fn();
    render(<ThemeProvider theme={createTheme({ reduceMotion: false })}><Drawer open onClose={onClose} title="d">body</Drawer></ThemeProvider>);
    swipe(screen.getByText('body'), 'x');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').style.transform).toBe('');
  });
  it('toast', async () => {
    function Push() { const toast = useToast(); return <button onClick={() => toast({ title: 'saved', duration: 60000 })}>push</button>; }
    render(<ThemeProvider theme={createTheme({ reduceMotion: false })}><Toaster><Push /></Toaster></ThemeProvider>);
    fireEvent.click(screen.getByText('push'));
    const t = (await screen.findByText('saved')).closest('.sg-toast') as HTMLElement;
    swipe(t, 'y', -1);   /* towards the top edge, well past the threshold */
    await act(async () => {});
    expect(screen.queryByText('saved')).not.toBeNull();
    expect(t.style.transform).toBe('');
  });
});

describe('Menu', () => {
  it('Tab closes it and gives focus back to its button, from where the browser moves on', async () => {
    const onClose = vi.fn();
    function T() {
      const ref = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<><button ref={ref} onClick={() => setOpen(true)}>more</button>
        <Menu open={open} onClose={(r) => { onClose(r); setOpen(false); }} anchor={ref.current} aria-label="m"><MenuItem>x</MenuItem></Menu></>);
    }
    render(<T />);
    fireEvent.click(screen.getByText('more'));
    await waitFor(() => expect(document.activeElement?.textContent).toBe('x'));
    const e = tab();
    expect(e.defaultPrevented).toBe(false);   /* not in a trap: the browser's own Tab goes on from the button */
    expect(document.activeElement?.textContent).toBe('more');
    expect(onClose).toHaveBeenCalledWith('backdrop');
  });

  it('an item\'s onClick runs and the item is still chosen; preventDefault keeps the menu open', async () => {
    const onClose = vi.fn(), select = vi.fn(), click = vi.fn();
    const { rerender } = render(<Menu open onClose={onClose} anchor={null} aria-label="m"><MenuItem onClick={click} onSelect={select}>x</MenuItem></Menu>);
    fireEvent.click(await screen.findByRole('menuitem'));
    expect(click).toHaveBeenCalled(); expect(select).toHaveBeenCalled(); expect(onClose).toHaveBeenCalledWith('select');
    onClose.mockClear(); select.mockClear();
    rerender(<Menu open onClose={onClose} anchor={null} aria-label="m"><MenuItem onClick={(e) => e.preventDefault()} onSelect={select}>x</MenuItem></Menu>);
    fireEvent.click(screen.getByRole('menuitem'));
    expect(select).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ContextMenu', () => {
  it('follows a child whose element is replaced', async () => {
    function Row({ editing }: { editing: boolean }) { return editing ? <div tabIndex={0}>row</div> : <span tabIndex={0}>row</span>; }
    const { rerender } = render(<ContextMenu menu={<MenuItem>copy</MenuItem>} aria-label="row"><Row editing={false} /></ContextMenu>);
    rerender(<ContextMenu menu={<MenuItem>copy</MenuItem>} aria-label="row"><Row editing /></ContextMenu>);
    await act(async () => {});   /* the mutation observer's turn */
    const row = screen.getByText('row');
    expect(row.tagName).toBe('DIV');
    fireEvent.contextMenu(row);
    expect(await screen.findByRole('menu')).toBeTruthy();
  });
});

describe('direction of anchored panels', () => {
  /* jsdom computes direction from the element's own style only, so the anchors carry it */
  it('a menu takes its anchor\'s direction, and so does a context menu its opener\'s', async () => {
    function Anchored() {
      const [el, setEl] = useState<HTMLButtonElement | null>(null);
      return <><button ref={setEl} style={{ direction: 'rtl' }}>open</button><Menu open={!!el} onClose={() => {}} anchor={el} aria-label="m"><MenuItem>a</MenuItem></Menu></>;
    }
    const { unmount } = render(<Anchored />);
    expect((await screen.findByRole('menu', { name: 'm' })).getAttribute('dir')).toBe('rtl');
    unmount();
    render(<ContextMenu menu={<MenuItem>copy</MenuItem>} aria-label="row"><div tabIndex={0} style={{ direction: 'rtl' }}>row</div></ContextMenu>);
    fireEvent.contextMenu(screen.getByText('row'));
    expect((await screen.findByRole('menu')).getAttribute('dir')).toBe('rtl');
  });
});

describe('Toast', () => {
  it('leaves in 110 ms under reduced motion', async () => {
    const spy = vi.spyOn(Element.prototype, 'animate');
    function Push() { const toast = useToast(); return <button onClick={() => toast({ title: 'saved', action: { label: 'undo', onClick: () => {} } })}>push</button>; }
    render(<ThemeProvider theme={createTheme({ reduceMotion: true })}><Toaster><Push /></Toaster></ThemeProvider>);
    fireEvent.click(screen.getByText('push'));
    spy.mockClear();
    fireEvent.click(await screen.findByText('undo'));
    expect(spy.mock.calls.some(([, o]) => (o as KeyframeAnimationOptions)?.duration === 110)).toBe(true);
    spy.mockRestore();
  });
});

describe('review follow-ups', () => {
  it('a popover whose last control is followed by controls out of the Tab order still hands Tab on in a dialog', async () => {
    const closed = vi.fn();
    function T() {
      const a = useRef<HTMLButtonElement>(null); const [pop, setPop] = useState(false);
      return (
        <Dialog open onClose={() => {}} title="Edit" actions={<><button ref={a} onClick={() => setPop(true)}>options</button><button>save</button></>}>
          <Popover open={pop} onClose={(r) => { closed(r); setPop(false); }} anchor={a.current} aria-label="options">
            <div role="tablist"><button role="tab" tabIndex={0}>one</button><button role="tab" tabIndex={-1}>two</button></div>
          </Popover>
        </Dialog>
      );
    }
    render(<T />);
    const options = screen.getByText('options');
    options.focus(); fireEvent.click(options);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('one'));
    expect(tab().defaultPrevented).toBe(true);
    expect(closed).toHaveBeenCalledWith('backdrop');
    expect(document.activeElement?.textContent).toBe('save');
  });

  /* compatibility guard: passes on main too, kept so the anchor-change check never closes twice */
  it('closes once when the app clears the anchor in onClose', async () => {
    const onClose = vi.fn();
    function T() {
      const [anchor, setAnchor] = useState<HTMLElement | null>(null);
      return (<><button onClick={(e) => setAnchor(e.currentTarget)}>more</button>
        <Menu open={anchor !== null} onClose={(r) => { onClose(r); setAnchor(null); }} anchor={anchor} aria-label="m"><MenuItem>x</MenuItem></Menu></>);
    }
    render(<T />);
    fireEvent.click(screen.getByText('more'));
    await screen.findByRole('menu');
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onClose.mock.calls).toEqual([['escape']]);
  });

  it('a panel that is leaving is out of reach (inert) while it folds away', async () => {
    function T() {
      const ref = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<><button ref={ref} onClick={() => setOpen(true)}>more</button>
        <Menu open={open} onClose={() => setOpen(false)} anchor={ref.current} aria-label="m"><MenuItem>x</MenuItem></Menu></>);
    }
    holdAnimations();
    render(<T />);
    fireEvent.click(screen.getByText('more'));
    const menu = await screen.findByRole('menu');
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(menu.isConnected).toBe(true);   /* its exit is still running */
    expect(menu.hasAttribute('inert')).toBe(true);
  });

  it.each([['accepts', true], ['declines', false]])('Tab from a menu whose parent %s the close', async (_, accept) => {
    const closed = vi.fn();
    function T() {
      const ref = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<><button ref={ref} onClick={() => setOpen(true)}>more</button>
        <Menu open={open} onClose={(r) => { closed(r); if (accept) setOpen(false); }} anchor={ref.current} aria-label="m"><MenuItem>x</MenuItem></Menu></>);
    }
    holdAnimations();
    render(<T />);
    fireEvent.click(screen.getByText('more'));
    const menu = await screen.findByRole('menu');
    await waitFor(() => expect(document.activeElement?.textContent).toBe('x'));
    act(() => { tab(); });
    expect(closed).toHaveBeenCalledWith('backdrop');
    expect(document.activeElement?.textContent).toBe('more');
    expect(menu.isConnected).toBe(true);
    /* a menu kept open (a form with unsaved edits) stays usable */
    expect(menu.hasAttribute('inert')).toBe(accept);
  });

  it('a dialog closed while the menu that opened it is still folding away gives focus to the menu\'s button', async () => {
    function T() {
      const ref = useRef<HTMLButtonElement>(null);
      const [menu, setMenu] = useState(false), [dialog, setDialog] = useState(false);
      return (<>
        <button ref={ref} onClick={() => setMenu(true)}>more</button>
        <Menu open={menu} onClose={() => setMenu(false)} anchor={ref.current} aria-label="actions"><MenuItem onSelect={() => setDialog(true)}>delete</MenuItem></Menu>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="Delete?" actions={<Button>OK</Button>} />
      </>);
    }
    render(<T />);
    const more = screen.getByText('more');
    more.focus(); fireEvent.click(more);
    const item = await screen.findByRole('menuitem', { name: 'delete' });
    await waitFor(() => expect(document.activeElement).toBe(item));
    holdAnimations();   /* the menu's 150 ms exit has not ended when Escape closes the dialog */
    fireEvent.click(item);
    expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true);
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(item.isConnected).toBe(true);
    expect(document.activeElement).toBe(more);
  });

  it('a popover whose last controls are in a disabled fieldset hands Tab on from its last enabled one', async () => {
    const closed = vi.fn();
    function T() {
      const a = useRef<HTMLButtonElement>(null); const [pop, setPop] = useState(false);
      return (
        <Dialog open onClose={() => {}} title="Edit" actions={<><button ref={a} onClick={() => setPop(true)}>options</button><button>save</button></>}>
          <Popover open={pop} onClose={(r) => { closed(r); setPop(false); }} anchor={a.current} aria-label="options">
            <button>one</button><fieldset disabled><button>two</button></fieldset>
          </Popover>
        </Dialog>
      );
    }
    render(<T />);
    const options = screen.getByText('options');
    options.focus(); fireEvent.click(options);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('one'));
    expect(tab().defaultPrevented).toBe(true);
    expect(closed).toHaveBeenCalledWith('backdrop');
    expect(document.activeElement?.textContent).toBe('save');
  });

  it('Tab moves on from where focus goes back when the anchor cannot take focus (a <span>)', async () => {
    function T() {
      const [span, setSpan] = useState<HTMLElement | null>(null); const [open, setOpen] = useState(false);
      return (<>
        <button onClick={() => setOpen(true)}>open</button>
        <span ref={setSpan}>about</span>
        <Popover open={open} onClose={() => setOpen(false)} anchor={span} aria-label="p"><button>one</button></Popover>
      </>);
    }
    render(<T />);
    const open = screen.getByText('open');
    open.focus(); fireEvent.click(open);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('one'));
    expect(tab().defaultPrevented).toBe(false);   /* the browser's own Tab goes on from the button */
    expect(document.activeElement).toBe(open);
  });
  it('placed again on another side, it folds towards the new place', async () => {
    const el = (r: DOMRect) => <Popover open onClose={() => {}} anchor={r} aria-label="p"><button>in</button></Popover>;
    const size = { w: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'), h: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight') };
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 150 });
    try {
      const { rerender } = render(el(new DOMRect(100, 100, 40, 20)));
      const panel = await screen.findByRole('dialog', { name: 'p' });
      expect(panel.dataset.side).toBe('bottom');
      const before = panel.style.transformOrigin;
      rerender(el(new DOMRect(100, innerHeight - 30, 40, 20)));   /* no room below: it goes above */
      expect(panel.dataset.side).toBe('top');
      expect(panel.style.transformOrigin).not.toBe(before);
      expect(panel.style.transformOrigin.split(' ')[1]).toBe('150px');   /* its bottom edge, against the anchor */
    } finally {
      for (const [k, d] of [['offsetWidth', size.w], ['offsetHeight', size.h]] as const) if (d) Object.defineProperty(HTMLElement.prototype, k, d); else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    }
  });
  it('Tab moves on from the anchor, not from where focus was when a shortcut opened the menu', async () => {
    function T() {
      const ref = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<>
        <input aria-label="search" onKeyDown={(e) => { if (e.key === 'k' && e.metaKey) setOpen(true); }} />
        <button ref={ref}>more</button>
        <Menu open={open} onClose={() => setOpen(false)} anchor={ref.current} aria-label="m"><MenuItem>x</MenuItem></Menu>
      </>);
    }
    render(<T />);
    const search = screen.getByLabelText('search');
    search.focus(); fireEvent.keyDown(search, { key: 'k', metaKey: true });
    await waitFor(() => expect(document.activeElement?.textContent).toBe('x'));
    expect(tab().defaultPrevented).toBe(false);   /* the browser's own Tab goes on from the button */
    expect(document.activeElement?.textContent).toBe('more');
  });

  /* compatibility guard: passes on main too, kept so the popover's own Tab never overrides its content's */
  it('a Tab the content takes (a text area that indents) does not close the popover', async () => {
    const onClose = vi.fn();
    render(<Popover open onClose={onClose} anchor={null} aria-label="note"><textarea aria-label="text" onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault(); }} /></Popover>);
    const ta = await screen.findByLabelText('text');
    ta.focus();
    tab();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Tab from a menu in a popover in a dialog moves on inside the dialog', async () => {
    const closed = vi.fn();
    function T() {
      const a = useRef<HTMLButtonElement>(null), b = useRef<HTMLButtonElement>(null);
      const [pop, setPop] = useState(false), [menu, setMenu] = useState(false);
      return (
        <Dialog open onClose={() => {}} title="Edit" actions={<><button ref={a} onClick={() => setPop(true)}>options</button><button>save</button></>}>
          <Popover open={pop} onClose={(r) => { closed('popover', r); setPop(false); }} anchor={a.current} aria-label="options">
            <button>first</button><button ref={b} onClick={() => setMenu(true)}>sort</button>
            <Menu open={menu} onClose={(r) => { closed('menu', r); setMenu(false); }} anchor={b.current} aria-label="sort by"><MenuItem>name</MenuItem></Menu>
          </Popover>
        </Dialog>
      );
    }
    render(<T />);
    const options = screen.getByText('options');
    options.focus(); fireEvent.click(options);
    const sort = await screen.findByText('sort');
    sort.focus(); fireEvent.click(sort);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('name'));
    expect(tab().defaultPrevented).toBe(true);
    expect(closed.mock.calls).toEqual([['menu', 'backdrop'], ['popover', 'backdrop']]);
    expect(document.activeElement?.textContent).toBe('save');
  });

  it('a dialog opened by an item of a menu that unmounts at once gives focus back to the menu\'s button', async () => {
    function T() {
      const ref = useRef<HTMLButtonElement>(null);
      const [menu, setMenu] = useState(false), [dialog, setDialog] = useState(false);
      return (<>
        <button ref={ref} onClick={() => setMenu(true)}>more</button>
        {menu && <Menu open onClose={() => setMenu(false)} anchor={ref.current} aria-label="actions"><MenuItem onSelect={() => setDialog(true)}>delete</MenuItem></Menu>}
        <Dialog open={dialog} onClose={() => setDialog(false)} title="Delete?" actions={<Button>OK</Button>} />
      </>);
    }
    render(<T />);
    const more = screen.getByText('more');
    more.focus(); fireEvent.click(more);
    const item = await screen.findByRole('menuitem', { name: 'delete' });
    await waitFor(() => expect(document.activeElement).toBe(item));
    fireEvent.click(item);
    expect(screen.queryByRole('menu')).toBeNull();
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(more);
  });
});

/* Suspense hiding a page that holds an open overlay (the docs show the loading page while the next page's module
   loads) runs the hidden tree's layout effect cleanups, not its passive ones. The overlay's layer is set aside in its
   place: the loading page is not locked, not hidden from assistive technology, and Escape is not taken. Shown again,
   it is the same opening (no second layer, no entrance, the focus back inside); closing it leaves nothing (#79) */
describe('an open overlay hidden by Suspense and shown again (#79)', () => {
  const gate = { hold: false, wake: () => {} };
  function Gate() { if (gate.hold) throw new Promise<void>((r) => { gate.wake = r; }); return null; }
  const hide = async (rerender: (ui: ReactElement) => void, ui: ReactElement) => { gate.hold = true; rerender(ui); await act(async () => {}); };
  const reveal = async (rerender: (ui: ReactElement) => void, ui: ReactElement) => { gate.hold = false; rerender(ui); await act(async () => { gate.wake(); }); };
  const hiddenFromAT = () => [...document.body.children].filter((c) => c.getAttribute('aria-hidden') === 'true').length;
  const dialogEl = () => (screen.queryByRole('dialog') ?? screen.getByRole('alertdialog'));
  const overlays: [string, (open: boolean, onClose: () => void) => ReactElement][] = [
    ['Sheet', (open, onClose) => <Sheet open={open} onClose={onClose} title="s">body <button>inside</button></Sheet>],
    ['Drawer', (open, onClose) => <Drawer open={open} onClose={onClose} title="d">body <button>inside</button></Drawer>],
    ['Dialog', (open, onClose) => <Dialog open={open} onClose={onClose} title="t">body</Dialog>],
  ];
  for (const [name, overlay] of overlays) {
    it(`${name}: set aside while hidden; the same opening when shown; nothing left once closed`, async () => {
      gate.hold = false;
      const onClose = vi.fn();
      const view = (open: boolean) => <Suspense fallback={<p>loading</p>}>{overlay(open, onClose)}<Gate /></Suspense>;
      const { rerender } = render(view(true));
      await act(async () => {});
      expect(topLayerCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');
      await hide(rerender, view(true));
      expect(screen.getByText('loading')).toBeTruthy();
      expect(document.body.style.overflow).toBe('');
      expect(hiddenFromAT()).toBe(0);
      act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
      expect(onClose).not.toHaveBeenCalled();
      const anim = vi.spyOn(Element.prototype, 'animate');
      await reveal(rerender, view(true));
      expect(topLayerCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');
      expect(anim).not.toHaveBeenCalled();
      expect(dialogEl().contains(document.activeElement)).toBe(true);
      anim.mockRestore();
      rerender(view(false));
      await waitFor(() => expect(topLayerCount()).toBe(0));
      await waitFor(() => expect(document.body.style.overflow).toBe(''));
      expect(hiddenFromAT()).toBe(0);
    });
  }
  it('gives the focus back to the button that opened it, when it is closed after being shown again', async () => {
    gate.hold = false;
    function Page({ open }: { open: boolean }) { return <><button>opener</button><Sheet open={open} onClose={() => {}} title="s">body <button>inside</button></Sheet></>; }
    const outside = <button>outside</button>;
    const view = (open: boolean) => <>{outside}<Suspense fallback={<p>loading</p>}><Page open={open} /><Gate /></Suspense></>;
    const { rerender } = render(view(false));
    screen.getByRole('button', { name: 'opener' }).focus();
    rerender(view(true));
    await act(async () => {});
    await hide(rerender, view(true));
    screen.getByRole('button', { name: 'outside' }).focus();   /* the focus moved on while the page was hidden */
    await reveal(rerender, view(true));
    rerender(view(false));
    await waitFor(() => expect(topLayerCount()).toBe(0));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'opener' }));
  });
  it('closed while hidden: shown again, it does not lock the page or take the focus, and goes', async () => {
    gate.hold = false;
    const view = (open: boolean) => <><button>outside</button><Suspense fallback={<p>loading</p>}><Sheet open={open} onClose={() => {}} title="s">body</Sheet><Gate /></Suspense></>;
    const { rerender } = render(view(true));
    await act(async () => {});
    await hide(rerender, view(true));
    gate.hold = true; rerender(view(false)); await act(async () => {});
    screen.getByRole('button', { name: 'outside' }).focus();
    const locks: string[] = [];
    const obs = new MutationObserver(() => locks.push(document.body.style.overflow));
    obs.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    await reveal(rerender, view(false));
    await waitFor(() => expect(topLayerCount()).toBe(0));
    obs.disconnect();
    expect(locks).not.toContain('hidden');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'outside' }));
  });
  it('hidden while closing: it still goes', async () => {
    gate.hold = false;
    const view = (open: boolean) => <Suspense fallback={<p>loading</p>}><Sheet open={open} onClose={() => {}} title="s">body</Sheet><Gate /></Suspense>;
    const { rerender } = render(view(true));
    await act(async () => {});
    rerender(view(false));   /* the exit starts */
    await hide(rerender, view(false));
    await reveal(rerender, view(false));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(topLayerCount()).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });
  it('keeps nested overlays in order: Escape still closes the inner one first', async () => {
    gate.hold = false;
    const closed: string[] = [];
    /* the inner one opened from the outer one, as a person would */
    const view = (inner: boolean) => <Suspense fallback={<p>loading</p>}>
      <Dialog open onClose={() => closed.push('dialog')} title="outer">outer
        <Sheet open={inner} onClose={() => closed.push('sheet')} title="inner">inner</Sheet>
      </Dialog><Gate /></Suspense>;
    const { rerender } = render(view(false));
    await act(async () => {});
    rerender(view(true));
    await act(async () => {});
    expect(topLayerCount()).toBe(2);
    await hide(rerender, view(true));
    await reveal(rerender, view(true));
    expect(topLayerCount()).toBe(2);
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(closed).toEqual(['sheet']);
  });
  it('a drag cut short by the hide is cancelled: released over the fallback it does not dismiss, and the Sheet comes back at rest', async () => {
    gate.hold = false;
    const onClose = vi.fn();
    const view = () => <Suspense fallback={<p>loading</p>}><Sheet open onClose={onClose} title="s">body</Sheet><Gate /></Suspense>;
    const { rerender } = render(view());
    await act(async () => {});
    const panel = screen.getByRole('dialog');
    const at = (d: number) => ({ pointerId: 7, button: 0, pointerType: 'touch', clientX: 100, clientY: 100 + d });
    fireEvent.pointerDown(screen.getByText('s'), at(0));
    for (const d of [20, 120, 300]) fireEvent.pointerMove(window, at(d));
    expect(panel.style.transform).not.toBe('');
    await hide(rerender, view());
    fireEvent.pointerMove(window, at(500));
    fireEvent.pointerUp(window, at(500));   /* over the loading page */
    expect(onClose).not.toHaveBeenCalled();
    await reveal(rerender, view());
    expect(panel.style.transform).toBe('');
  });
  it('a Dialog whose last button went while hidden takes the focus itself when shown again', async () => {
    gate.hold = false;
    const view = (withButton: boolean) => <><button>outside</button><Suspense fallback={<p>loading</p>}>
      <Dialog open onClose={() => {}} title="t">{withButton ? <button>only</button> : 'text'}</Dialog><Gate /></Suspense></>;
    const { rerender } = render(view(true));
    await act(async () => {});
    await hide(rerender, view(true));
    gate.hold = true; rerender(view(false)); await act(async () => {});
    screen.getByRole('button', { name: 'outside' }).focus();
    await reveal(rerender, view(false));
    const d = screen.queryByRole('dialog') ?? screen.getByRole('alertdialog');
    expect(d.contains(document.activeElement)).toBe(true);
  });
  it('a Menu set aside is not closed by a press on the fallback, nor by its anchor hidden with it', async () => {
    gate.hold = false;
    const onClose = vi.fn();
    function Page({ open }: { open: boolean }) {
      const ref = useRef<HTMLButtonElement>(null);
      return <><button ref={ref}>more</button><Menu open={open} onClose={onClose} anchor={ref.current} aria-label="actions"><MenuItem onSelect={() => {}}>one</MenuItem></Menu></>;
    }
    const view = (open: boolean) => <Suspense fallback={<p>loading</p>}><Page open={open} /><Gate /></Suspense>;
    const { rerender } = render(view(false));
    rerender(view(true));
    await act(async () => {});
    const more = screen.getByText('more');
    expect(topLayerCount()).toBe(1);
    await hide(rerender, view(true));
    fireEvent.pointerDown(screen.getByText('loading'));
    resized(more);   /* hidden with the page: no box */
    expect(onClose.mock.calls).toEqual([]);
    await reveal(rerender, view(true));
    expect(onClose.mock.calls).toEqual([]);
    expect(topLayerCount()).toBe(1);
    expect(screen.getByRole('menu')).toBeTruthy();
  });
  it('nested anchored panels shown again are placed outermost first', async () => {
    gate.hold = false;
    /* layout stand-in: the page's button sits at `top`; a button inside a panel sits 10 px below the panel's top */
    let top = 40;
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const el = this as HTMLElement;
      if (el.id === 'a') return new DOMRect(10, top, 40, 20);
      const panel = el.parentElement?.closest<HTMLElement>('[role=dialog], [role=menu]');
      if (el.tagName === 'BUTTON' && panel) return new DOMRect(10, (parseFloat(panel.style.top) || 0) + 10, 40, 20);
      return new DOMRect(0, 0, 0, 0);
    });
    function Page() {
      const [a, setA] = useState<HTMLButtonElement | null>(null), [b, setB] = useState<HTMLButtonElement | null>(null), [c, setC] = useState<HTMLButtonElement | null>(null);
      return <><button id="a" ref={setA}>a</button>
        <Popover open onClose={() => {}} anchor={a} aria-label="one"><button ref={setB}>b</button>
          <Popover open onClose={() => {}} anchor={b} aria-label="two"><button ref={setC}>c</button>
            <Menu open onClose={() => {}} anchor={c} aria-label="three"><MenuItem onSelect={() => {}}>x</MenuItem></Menu>
          </Popover>
        </Popover></>;
    }
    const view = () => <Suspense fallback={<p>loading</p>}><Page /><Gate /></Suspense>;
    const { rerender } = render(view());
    await act(async () => {});
    const tops = () => [screen.getByRole('dialog', { name: 'one' }), screen.getByRole('dialog', { name: 'two' }), screen.getByRole('menu', { name: 'three' })].map((p) => parseFloat(p.style.top));
    await hide(rerender, view());
    top = 100;   /* the page's button moved while hidden */
    await reveal(rerender, view());
    /* each against its anchor where that is now: the same step from panel to panel, the first below the moved button */
    const [t1, t2, t3] = tops();
    expect(t1).toBeGreaterThan(120);
    expect(t2 - t1).toBe(t3 - t2);
    expect(t2 - t1).toBeGreaterThan(0);
    rect.mockRestore();
  });
  it('a Menu whose anchor a later effect hides as the page is shown again closes', async () => {
    gate.hold = false;
    const onClose = vi.fn();
    const later = { hide: false };
    /* after the Menu in the tree, so its layout effect runs after the Menu is shown again, in the same commit */
    function HideAnchor() { useLayoutEffect(() => { if (later.hide) document.getElementById('anchor')!.style.display = 'none'; }, []); return null; }
    function Page() {
      const ref = useRef<HTMLButtonElement>(null);
      const [, force] = useState(0);
      useLayoutEffect(() => { force(1); }, []);   /* a second render, with the ref set */
      return <><button id="anchor" ref={ref}>more</button><Menu open onClose={onClose} anchor={ref.current} aria-label="actions"><MenuItem onSelect={() => {}}>one</MenuItem></Menu><HideAnchor /></>;
    }
    const view = () => <Suspense fallback={<p>loading</p>}><Page /><Gate /></Suspense>;
    const { rerender } = render(view());
    await act(async () => {});
    await hide(rerender, view());
    later.hide = true;
    await reveal(rerender, view());
    expect(onClose).toHaveBeenCalledWith('anchor');
  });
  it('a Menu opened again after closing while hidden still closes on a press outside', async () => {
    gate.hold = false;
    const onClose = vi.fn();
    function Page({ open }: { open: boolean }) {
      const ref = useRef<HTMLButtonElement>(null);
      return <><button ref={ref}>more</button><Menu open={open} onClose={onClose} anchor={ref.current} aria-label="actions"><MenuItem onSelect={() => {}}>one</MenuItem></Menu></>;
    }
    const view = (open: boolean) => <><p>page</p><Suspense fallback={<p>loading</p>}><Page open={open} /><Gate /></Suspense></>;
    const { rerender } = render(view(false));
    rerender(view(true));
    await act(async () => {});
    await hide(rerender, view(true));
    gate.hold = true; rerender(view(false)); await act(async () => {});
    await reveal(rerender, view(false));
    await waitFor(() => expect(topLayerCount()).toBe(0));
    rerender(view(true));
    await act(async () => {});
    fireEvent.pointerDown(screen.getByText('page'));
    expect(onClose).toHaveBeenCalledWith('backdrop');
  });
  it('a Drawer resize cut short by the hide is cancelled: the height it started at, and the app is not told', async () => {
    gate.hold = false;
    const onHeightChange = vi.fn();
    const view = () => <Suspense fallback={<p>loading</p>}><Drawer open onClose={() => {}} side="bottom" resizable height="300px" onHeightChange={onHeightChange} title="d">body</Drawer><Gate /></Suspense>;
    const { rerender } = render(view());
    await act(async () => {});
    const panel = screen.getByRole('dialog'), grip = screen.getByRole('separator');
    const at = (d: number) => ({ pointerId: 9, button: 0, pointerType: 'mouse', clientX: 100, clientY: 400 + d });
    fireEvent.pointerDown(grip, at(0));
    fireEvent.pointerMove(window, at(-50));
    await hide(rerender, view());
    fireEvent.pointerUp(window, at(-50));
    expect(onHeightChange).not.toHaveBeenCalled();
    await reveal(rerender, view());
    expect(onHeightChange).not.toHaveBeenCalled();
    expect(panel.style.getPropertyValue('--_h')).toBe('300px');
  });
  it('a Drawer resize cancelled keeps a height the app set before its first move', async () => {
    gate.hold = false;
    const view = (h: string) => <Suspense fallback={<p>loading</p>}><Drawer open onClose={() => {}} side="bottom" resizable height={h} onHeightChange={() => {}} title="d">body</Drawer><Gate /></Suspense>;
    const { rerender } = render(view('300px'));
    await act(async () => {});
    const panel = screen.getByRole('dialog'), grip = screen.getByRole('separator');
    const at = (d: number) => ({ pointerId: 9, button: 0, pointerType: 'mouse', clientX: 100, clientY: 400 + d });
    fireEvent.pointerDown(grip, at(0));
    rerender(view('350px'));   /* the app's own change, before the pointer moved */
    fireEvent.pointerMove(window, at(-50));
    await hide(rerender, view('350px'));
    await reveal(rerender, view('350px'));
    expect(panel.style.getPropertyValue('--_h')).toBe('350px');
  });
  it('a Drawer resize cancelled keeps a height the app set during it', async () => {
    gate.hold = false;
    const view = (h: string) => <Suspense fallback={<p>loading</p>}><Drawer open onClose={() => {}} side="bottom" resizable height={h} onHeightChange={() => {}} title="d">body</Drawer><Gate /></Suspense>;
    const { rerender } = render(view('300px'));
    await act(async () => {});
    const panel = screen.getByRole('dialog'), grip = screen.getByRole('separator');
    const at = (d: number) => ({ pointerId: 9, button: 0, pointerType: 'mouse', clientX: 100, clientY: 400 + d });
    fireEvent.pointerDown(grip, at(0));
    fireEvent.pointerMove(window, at(-50));
    rerender(view('350px'));   /* the app's own change, mid-drag */
    fireEvent.pointerMove(window, at(-60));
    await hide(rerender, view('350px'));
    await reveal(rerender, view('350px'));
    expect(panel.style.getPropertyValue('--_h')).toBe('350px');
  });
  it('a MediaViewer closed while hidden leaves the focus where it was moved meanwhile', async () => {
    gate.hold = false;
    const items = [{ alt: 'one', width: 4, height: 3, render: () => <div /> }];
    const view = (open: boolean) => <><button id="thumb">thumb</button><button>outside</button><Suspense fallback={<p>loading</p>}>
      <MediaViewer open={open} onClose={() => {}} items={items} getOrigin={() => document.getElementById('thumb')} aria-label="photos" /><Gate /></Suspense></>;
    const { rerender } = render(view(false));
    document.getElementById('thumb')!.focus();
    rerender(view(true));
    await act(async () => {});
    await hide(rerender, view(true));
    screen.getByRole('button', { name: 'outside' }).focus();
    gate.hold = true; rerender(view(false)); await act(async () => {});
    await reveal(rerender, view(false));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'outside' }));
  });
});

/* StrictMode runs an overlay's effects twice on mount (set up, taken down, set up): one layer, and closing leaves
   nothing (#79) */
describe('an anchored panel given no anchor while open', () => {
  it('keeps a point it was placed against', async () => {
    const view = (at: DOMRect | undefined) => <Menu open onClose={() => {}} anchor={at} aria-label="actions"><MenuItem onSelect={() => {}}>one</MenuItem></Menu>;
    const { rerender } = render(view(new DOMRect(20, 30, 0, 0)));
    await act(async () => {});
    const menu = screen.getByRole('menu'), before = [menu.style.left, menu.style.top];
    rerender(view(undefined));   /* `anchor={ref.current?.getBoundingClientRect()}` with the ref let go of */
    await act(async () => {});
    expect([menu.style.left, menu.style.top]).toEqual(before);
  });
});

describe('an overlay opened under StrictMode', () => {
  for (const [name, overlay] of [
    ['Sheet', (open: boolean) => <Sheet open={open} onClose={() => {}} title="s">body</Sheet>],
    ['Drawer', (open: boolean) => <Drawer open={open} onClose={() => {}} title="d">body</Drawer>],
  ] as const) {
    it(`${name}: one layer, nothing left once closed`, async () => {
      const { rerender } = render(<StrictMode>{overlay(true)}</StrictMode>);
      await act(async () => {});
      expect(topLayerCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');
      rerender(<StrictMode>{overlay(false)}</StrictMode>);
      await waitFor(() => expect(topLayerCount()).toBe(0));
      await waitFor(() => expect(document.body.style.overflow).toBe(''));
    });
  }
  it('Menu: a press outside still closes it; an anchor set to none keeps its element, and closes once that goes', async () => {
    const onClose = vi.fn();
    function T({ none, gone = false }: { none: boolean; gone?: boolean }) {
      const ref = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return <><p>page</p><button ref={ref} onClick={() => setOpen(true)} style={gone ? { display: 'none' } : undefined}>more</button><Menu open={open} onClose={onClose} anchor={none ? null : ref.current} aria-label="actions"><MenuItem onSelect={() => {}}>one</MenuItem></Menu></>;
    }
    const { rerender } = render(<StrictMode><T none={false} /></StrictMode>);
    fireEvent.click(screen.getByText('more'));
    await act(async () => {});
    fireEvent.pointerDown(screen.getByText('page'));
    expect(onClose).toHaveBeenLastCalledWith('backdrop');
    onClose.mockClear();
    rerender(<StrictMode><T none /></StrictMode>);
    await act(async () => {});
    expect(onClose).not.toHaveBeenCalled();
    rerender(<StrictMode><T none gone /></StrictMode>);
    resized(screen.getByText('more'));
    expect(onClose).toHaveBeenLastCalledWith('anchor');
  });
});
