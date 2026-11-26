/* The droplet-bridge indicator SegmentedControl, TabBar and Tabs share. Internal: it relies on their markup (direct
   [data-sg-item] children) and is not exported from any entry point (exports.test.ts holds the public list). */
import { useRef } from 'react';
import { createBridge, createOverflowStrip, type Bridge, type OverflowStrip } from '@satin-glass/core';
import { useIsoLayoutEffect } from './utils';

const itemsOf = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(':scope > [data-sg-item]'));

/** Shared by SegmentedControl and TabBar: the droplet-bridge indicator, on a track that scrolls sideways when
    the items do not fit (the selected item is kept in view). */
export function useBridge(container: React.RefObject<HTMLElement | null>, indicator: React.RefObject<HTMLElement | null>, index: number, onDragCommit: (i: number) => void, draggable = true) {
  const bridge = useRef<Bridge | null>(null), strip = useRef<OverflowStrip | null>(null), sizes = useRef<ResizeObserver | null>(null);
  const commit = useRef(onDragCommit); commit.current = onDragCommit;
  const at = useRef(index); at.current = index;
  /* set up again whenever the track, the indicator or `draggable` changes (Tabs switched from pills to the
     underline gains an indicator; a TabBar made draggable later). `draggable` alone sets up only the drop, so the
     strip keeps where the user scrolled it */
  const made = useRef<{ c: HTMLElement; ind: HTMLElement; draggable: boolean } | null>(null);
  const teardown = () => { bridge.current?.destroy(); bridge.current = null; strip.current?.destroy(); strip.current = null; sizes.current?.disconnect(); sizes.current = null; made.current = null; };
  useIsoLayoutEffect(() => () => teardown(), []);
  useIsoLayoutEffect(() => {
    const c = container.current, ind = indicator.current, was = made.current;
    if (was && was.c === c && was.ind === ind && was.draggable === draggable) return;
    if (!c || !ind) { teardown(); return; }
    const items = () => itemsOf(c);
    const makeBridge = () => {
      bridge.current = createBridge(c, ind, {
        items, draggable,
        /* a drop released over a disabled item, or a value the (controlled) parent refuses, springs back home */
        onDragCommit: (i) => { commit.current(i); requestAnimationFrame(() => { if (at.current !== i) bridge.current?.moveTo(at.current); }); },
        onHover: (i) => items().forEach((el, j) => el.toggleAttribute('data-hover', i === j)),
      });
      bridge.current.moveTo(at.current, false);
    };
    if (was && was.c === c && was.ind === ind) { bridge.current?.destroy(); made.current = { c, ind, draggable }; makeBridge(); return; }
    teardown();
    made.current = { c, ind, draggable };
    makeBridge();
    strip.current = createOverflowStrip(c, items);
    strip.current.reveal(items()[index], false);
    /* items sized to their labels can change width without the track changing (e.g. a late font): the drop follows
       (retargeted, so a move in flight keeps going; never while a finger holds it) */
    const seen = new WeakMap<Element, number>();
    sizes.current = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
      let moved = false;
      for (const e of entries) { const w = e.contentRect.width, was = seen.get(e.target); seen.set(e.target, w); if (was !== undefined && Math.abs(w - was) >= 0.5) moved = true; }
      if (moved && !c.hasAttribute('data-sg-dragging')) bridge.current?.moveTo(at.current);
    }) : null;
  });
  useIsoLayoutEffect(() => {
    bridge.current?.moveTo(index);
    const c = container.current;
    if (c) strip.current?.reveal(itemsOf(c)[index]);
  }, [index]);
  /* items added or removed: watch the new first / last item for the edge fades, and every item's size */
  useIsoLayoutEffect(() => {
    strip.current?.refresh();
    const c = container.current;
    if (c && sizes.current) for (const el of itemsOf(c)) sizes.current.observe(el);
  });
}
