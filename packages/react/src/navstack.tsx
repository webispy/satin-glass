/* NavigationStack (0.3): drill-in navigation inside a region — a settings list whose rows open their own pages, as
   deep as needed. push() slides the next page in from the trailing edge over the current one (which drifts a third
   of the way back under a shade); the back button, or a swipe from the leading edge on touch, takes it off again.
   Pages below stay mounted, so each keeps its scroll position and state. With reduced motion pages cross-fade.
   Each page is a NavigationPage: the library's AppBar on top (its title, a back button named after the page below,
   trailing actions) and the page's content scrolling under it. Focus moves to the new page's title on push and back
   to the row that opened it on pop. */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { animate, drag, fade, prefersReducedMotion, type MotionName } from '@glass-layer/core';
import { cx, useIsoLayoutEffect } from './utils';
import { AppBar } from './layout';
import { Button } from './controls';
import { ChevronLeftIcon } from './icons';

export type NavigationApi = {
  /** open a page on top (an element, usually a NavigationPage or a component that renders one) */
  push: (page: ReactNode) => void;
  /** back one page */
  pop: () => void;
  /** back to the first page */
  popToRoot: () => void;
  /** 0 on the first page */
  depth: number;
};
const NavCtx = createContext<NavigationApi | null>(null);
type PageInfo = { index: number; back: ReactNode | null; scroller: HTMLElement | null; setTitle: (i: number, t: ReactNode) => void; backLabel: string; pop: () => void };
const PageCtx = createContext<PageInfo | null>(null);

/** The stack that a page is in (push / pop from rows and buttons inside it). */
export function useNavigation(): NavigationApi {
  const n = useContext(NavCtx);
  if (!n) throw new Error('useNavigation: not inside a NavigationStack');
  return n;
}

type Entry = { key: number; node: ReactNode; from: Element | null };
type Move = { dir: 'push' | 'pop' | 'drag'; top: number; to?: number } | null;

export type NavigationStackProps = {
  /** the first page */
  children: ReactNode;
  /** the back button's accessible prefix (default 'Back'): "Back: Settings" */
  labels?: { back?: string };
  /** called after the depth changes */
  onDepthChange?: (depth: number) => void;
  motion?: MotionName;
  className?: string; style?: CSSProperties;
};

const SHIFT = 0.3;   /* how far the page below drifts back */

export function NavigationStack({ children, labels, onDepthChange, motion, className, style }: NavigationStackProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [move, setMove] = useState<Move>(null);
  const [titles, setTitles] = useState<ReactNode[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const pages = useRef<(HTMLDivElement | null)[]>([]);
  const keySeq = useRef(0);
  const busy = useRef(false);
  const st = useRef({ entries, move }); st.current = { entries, move };
  const depth = entries.length;
  const depthCb = useRef(onDepthChange); depthCb.current = onDepthChange;

  const layer = (i: number) => pages.current[i] ?? null;
  const shade = (i: number) => layer(i)?.querySelector<HTMLElement>(':scope > .gl-nav__shade') ?? null;
  const focusTitle = (i: number) => layer(i)?.querySelector<HTMLElement>('[data-gl-nav-title]')?.focus({ preventScroll: true });
  const width = () => box.current?.clientWidth || 360;
  const clear = (...els: (HTMLElement | null)[]) => { for (const el of els) el?.getAnimations().forEach((a) => a.cancel()); };

  const push = useCallback((node: ReactNode) => {
    if (busy.current) return;
    busy.current = true;
    const from = document.activeElement;
    setEntries((e) => [...e, { key: ++keySeq.current, node, from }]);
    setMove({ dir: 'push', top: st.current.entries.length + 1 });
  }, []);

  /* pop: slide the top page off (from where a swipe left it, if any) over page `to`, then drop everything above it */
  const popFrom = useCallback((dx = 0, vx = 0, toIndex?: number) => {
    const top = st.current.entries.length;
    if (top === 0) return;
    const to = Math.max(0, Math.min(top - 1, toIndex ?? top - 1));
    busy.current = true;
    setMove({ dir: 'pop', top, to });
    const a = layer(top), b = layer(to), sh = shade(to), W = width();
    const done = () => {
      const e = st.current.entries[to];   /* the entry pushed from page `to` remembers the row that pushed it */
      /* the leaving page keeps its end state until React removes it: cancelling its animation here put it back over
         the screen for a frame (a flash of the page just left) */
      clear(b, sh);
      setEntries((x) => x.slice(0, to));
      setMove(null);
      busy.current = false;
      depthCb.current?.(to);
      refocus.current = { el: e?.from ?? null, page: to };
    };
    if (!a || !b) { done(); return; }
    if (prefersReducedMotion(a)) { clear(b, sh); fade(a, 1, 0, 160).then(done); return; }
    /* a fling carries on at its own speed: the spring starts with the finger's velocity folded into its distance */
    void vx;
    const p = Promise.all([
      animate(a, [{ transform: `translateX(${dx}px)` }, { transform: `translateX(${W}px)` }], 'smooth').finished,
      animate(b, [{ transform: `translateX(${-W * SHIFT + dx * SHIFT}px)` }, { transform: 'translateX(0px)' }], 'smooth').finished,
      sh ? animate(sh, [{ opacity: 1 - dx / W }, { opacity: 0 }], 'smooth').finished : Promise.resolve(),
    ]);
    p.then(done, done);
  }, []);
  const pop = useCallback(() => { if (!busy.current) popFrom(); }, [popFrom]);
  /* the top page slides off straight over the first one; the pages between go with it */
  const popToRoot = useCallback(() => { if (!busy.current) popFrom(0, 0, 0); }, [popFrom]);

  /* after a pop has been drawn (the page below is no longer inert): focus back to the row that opened the page */
  const refocus = useRef<{ el: Element | null; page: number } | null>(null);
  useIsoLayoutEffect(() => {
    const r = refocus.current; if (!r) return;
    refocus.current = null;
    /* the row that opened the page (Safari does not focus a clicked button: then the page's title) */
    if (r.el instanceof HTMLElement && layer(r.page)?.contains(r.el)) r.el.focus({ preventScroll: true }); else focusTitle(r.page);
  }, [entries.length]);

  /* push: run the slide once the new page is in the DOM */
  useIsoLayoutEffect(() => {
    if (move?.dir !== 'push') return;
    const top = move.top, a = layer(top), b = layer(top - 1), sh = shade(top - 1), W = width();
    const done = () => {
      clear(a, b, sh);
      setMove(null);
      busy.current = false;
      depthCb.current?.(top);
    };
    focusTitle(top);
    if (!a || !b) { done(); return; }
    if (prefersReducedMotion(a)) { fade(a, 0, 1, 180).then(done); return; }
    Promise.all([
      animate(a, [{ transform: `translateX(${W}px)` }, { transform: 'translateX(0px)' }], 'smooth').finished,
      animate(b, [{ transform: 'translateX(0px)' }, { transform: `translateX(${-W * SHIFT}px)` }], 'smooth').finished,
      sh ? animate(sh, [{ opacity: 0 }, { opacity: 1 }], 'smooth').finished : Promise.resolve(),
    ]).then(done, done);
  }, [move]);

  /* swipe back from the leading edge (touch and pen; a mouse has the back button) */
  useIsoLayoutEffect(() => {
    const el = box.current; if (!el) return;
    let W = 0, x0 = 0;
    return drag(el, {
      axis: 'x', threshold: 8,
      start: (i) => {
        if (i.event.pointerType === 'mouse' || busy.current || st.current.entries.length === 0) return false;
        const r = el.getBoundingClientRect();
        if (i.x - r.left > 28) return false;
        W = r.width; x0 = 0;
        return undefined;
      },
      move: (i) => {
        const top = st.current.entries.length;
        if (!busy.current) { busy.current = true; setMove({ dir: 'drag', top }); }
        x0 = Math.max(0, Math.min(W, i.dx));
        const a = layer(top), b = layer(top - 1), sh = shade(top - 1);
        if (a) a.style.transform = `translateX(${x0}px)`;
        if (b) b.style.transform = `translateX(${-W * SHIFT + x0 * SHIFT}px)`;
        if (sh) sh.style.opacity = String(1 - x0 / W);
      },
      end: (i, cancelled) => {
        if (st.current.move?.dir !== 'drag') return;
        const top = st.current.entries.length, a = layer(top), b = layer(top - 1), sh = shade(top - 1);
        for (const e of [a, b, sh]) if (e) { e.style.transform = ''; e.style.opacity = ''; }
        if (!cancelled && (x0 > W * 0.4 || (i.vx > 500 && x0 > 16))) { popFrom(x0, i.vx); return; }
        /* not far enough: back into place */
        const back = () => { clear(a, b, sh); setMove(null); busy.current = false; };
        Promise.all([
          a ? animate(a, [{ transform: `translateX(${x0}px)` }, { transform: 'translateX(0px)' }], 'snappy').finished : null,
          b ? animate(b, [{ transform: `translateX(${-W * SHIFT + x0 * SHIFT}px)` }, { transform: `translateX(${-W * SHIFT}px)` }], 'snappy').finished : null,
          sh ? animate(sh, [{ opacity: 1 - x0 / W }, { opacity: 1 }], 'snappy').finished : null,
        ]).then(back, back);
      },
    });
  }, [popFrom]);

  const api = useMemo<NavigationApi>(() => ({ push, pop, popToRoot, depth }), [push, pop, popToRoot, depth]);
  const setTitle = useCallback((i: number, t: ReactNode) => setTitles((x) => { if (x[i] === t) return x; const n = x.slice(); n[i] = t; return n; }), []);
  const layers = [{ key: 0, node: children }, ...entries];
  /* each page's own scroll box, handed to its AppBar (its glass and large title follow that page's scrolling) */
  const [els, setEls] = useState<(HTMLDivElement | null)[]>([]);
  useIsoLayoutEffect(() => { const now = pages.current.slice(0, layers.length); if (now.some((e, i) => e !== els[i]) || now.length !== els.length) setEls(now); });
  const top = layers.length - 1;
  /* which layers are on screen: the top one, and the one below while a page moves */
  const showing = (i: number) => i === top || (move?.dir === 'pop' ? i === move.to : move !== null && i === top - 1);

  return (
    <NavCtx.Provider value={api}>
      <div ref={box} className={cx('gl-nav', className)} style={style} data-gl-motion={motion} data-moving={move ? move.dir : undefined}>
        {layers.map((l, i) => (
          <div key={l.key} ref={(el) => { pages.current[i] = el; }} className="gl-nav__page" data-depth={i}
            data-hidden={!showing(i) || undefined} inert={i !== top || undefined} aria-hidden={i !== top || undefined}>
            <div className="gl-nav__scroll">
              <PageCtx.Provider value={{ index: i, back: i > 0 ? titles[i - 1] ?? null : null, scroller: (els[i]?.firstElementChild as HTMLElement) ?? null, setTitle, backLabel: labels?.back ?? 'Back', pop }}>
                {l.node}
              </PageCtx.Provider>
            </div>
            <div className="gl-nav__shade" aria-hidden="true" />
          </div>
        ))}
      </div>
    </NavCtx.Provider>
  );
}

export type NavigationPageProps = {
  title: ReactNode;
  /** actions at the trailing end of the bar */
  trailing?: ReactNode;
  /** a large title under the bar that hands over to the small one as the page scrolls */
  largeTitle?: boolean;
  children?: ReactNode;
  className?: string; style?: CSSProperties;
};

/** One page of a NavigationStack: a bar with the title and a back button (from the second page on), then content. */
export function NavigationPage({ title, trailing, largeTitle, children, className, style }: NavigationPageProps) {
  const info = useContext(PageCtx);
  if (!info) throw new Error('NavigationPage: not inside a NavigationStack');
  useIsoLayoutEffect(() => { info.setTitle(info.index, title); }, [title, info.index]);
  const back = info.index > 0 ? (
    <Button variant="plain" size="sm" className="gl-nav__back" startIcon={<ChevronLeftIcon />} onClick={info.pop}>
      <span className="gl-visually-hidden">{`${info.backLabel}: `}</span>{info.back ?? info.backLabel}
    </Button>
  ) : null;
  return (
    <div className={cx('gl-navpage', className)} style={style}>
      <AppBar title={<span tabIndex={-1} data-gl-nav-title="">{title}</span>} leading={back} trailing={trailing} scrollTarget={info.scroller} transparentAtTop largeTitle={largeTitle} />
      <div className="gl-navpage__body">{children}</div>
    </div>
  );
}
