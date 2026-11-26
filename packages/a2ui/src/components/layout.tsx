/* Text, Row, Column, List, Card, Divider, Tabs and Modal of the A2UI basic catalog, drawn with Satin controls. */
import { createContext, Fragment, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Button, Card, CardBody, Dialog, Divider, Stack, Tabs, Text } from '@satin-glass/react';
import { agentA11y, CardDepthContext, EdgeContext, FlowContext, grow, InButtonContext, InTriggerContext, MEDIA_TEXT_MIN, PANEL_MIN, RowContext, useEnv, useHostSink, useSlot, type Child, type Edge, type Rendered } from './shared';

/* ---- Text: the catalog's basic Markdown — headings, bold, italics, inline code, lists and paragraphs. No HTML, and
   links and images are their text only, as the catalog allows. v0.9.1 names headings with `variant` h1–h5. */
const HEADING = ['body', 'title-1', 'title-2', 'title-3', 'headline', 'headline', 'headline'] as const;
/* a number with group separators ("$850,000,000,000.00", "-0.5%") is one word: browsers may break after its commas */
const NUMBER = /[-+−]?[$€£¥₩]?\d{1,3}(?:[,.\u00a0\u202f]\d{3})+(?:[.,]\d+)?%?/g;
function numbers(s: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, k = 0;
  NUMBER.lastIndex = 0;
  while ((m = NUMBER.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(<span key={`${key}-${k++}`} style={{ whiteSpace: 'nowrap' }}>{m[0]}</span>);
    last = NUMBER.lastIndex;
  }
  if (!out.length) return [s];
  if (last < s.length) out.push(s.slice(last));
  return out;
}
function inline(s: string): ReactNode[] {
  const raw: ReactNode[] = [];
  const out = { push: (n: ReactNode) => { if (typeof n === 'string') raw.push(...numbers(n, `n${raw.length}`)); else raw.push(n); } };
  /* ![alt](url) and [text](url) keep their text; **bold**, *italic* / _italic_, `code` */
  const re = /!?\[([^\]]*)\]\([^)]*\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1] !== undefined) out.push(m[1]);
    else if (m[2] !== undefined) out.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3] !== undefined || m[4] !== undefined) out.push(<em key={k++}>{m[3] ?? m[4]}</em>);
    else if (m[5] !== undefined) out.push(<code key={k++} style={{ fontFamily: 'var(--sg-font-mono)', fontSize: '0.92em' }}>{m[5]}</code>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return raw;
}
type Block = { kind: 'h'; level: number; text: string } | { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] };
function blocks(md: string): Block[] {
  const out: Block[] = [];
  for (const chunk of md.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
    if (h && lines.length === 1) { out.push({ kind: 'h', level: h[1].length, text: h[2] }); continue; }
    if (lines.every((l) => /^\s*[-*+]\s+/.test(l))) { out.push({ kind: 'ul', items: lines.map((l) => l.replace(/^\s*[-*+]\s+/, '')) }); continue; }
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) { out.push({ kind: 'ol', items: lines.map((l) => l.replace(/^\s*\d+[.)]\s+/, '')) }); continue; }
    if (h) { out.push({ kind: 'h', level: h[1].length, text: h[2] }); lines.shift(); }
    out.push({ kind: 'p', text: lines.join('\n') });
  }
  return out;
}
export function A2uiText(r: Rendered<{ text?: unknown; variant?: string }>) {
  const { props } = r;
  const inButton = useContext(InButtonContext);
  const slot = useSlot(r);
  const raw = props.text == null ? '' : String(props.text);
  const caption = props.variant === 'caption';
  const vh = /^h([1-5])$/.exec(props.variant ?? '');
  /* a word longer than its line breaks, others do not: in a Row, text gives way to its siblings down to its longest
     word, wrapping between words (a table's cells keep theirs whole: see TableContext) */
  const style: CSSProperties = {
    ...grow(props.weight), overflowWrap: 'break-word',
    /* a cell of a Row (the agent's weights keep its columns in line from row to row): figures of one width, so
       amounts line up digit by digit */
    ...(slot.inRow && props.weight ? { fontVariantNumeric: 'tabular-nums' } : {}),
  };
  if (vh) {
    const level = Number(vh[1]);
    return <Text variant={HEADING[level]} as={`h${Math.min(level + 1, 6)}` as 'h2'} style={style}>{inline(raw)}</Text>;
  }
  const list = blocks(raw);
  /* a plain label in a button: no paragraph and no text style of its own, so it takes the button's type and colour.
     Its line breaks and wrapping stay as the paragraph had them (the button keeps its own label on one line) */
  if (inButton && !caption && list.length <= 1 && (!list[0] || list[0].kind === 'p')) {
    return <span style={{ ...style, whiteSpace: 'pre-line' }}>{inline(list[0]?.kind === 'p' ? list[0].text : raw)}</span>;
  }
  const para = (s: string, key?: number) => (
    <Text key={key} variant={caption ? 'footnote' : 'body'} tone={caption ? 'secondary' : 'default'} style={{ whiteSpace: 'pre-line', ...(key === undefined ? style : {}) }}>{inline(s)}</Text>
  );
  if (list.length <= 1 && (!list[0] || list[0].kind === 'p')) return para(list[0]?.kind === 'p' ? list[0].text : raw);
  return (
    <Stack gap={2} style={style}>
      {list.map((b, i) => b.kind === 'h'
        ? <Text key={i} variant={HEADING[b.level] ?? 'headline'} as={`h${Math.min(b.level + 1, 6)}` as 'h2'}>{inline(b.text)}</Text>
        : b.kind === 'p' ? para(b.text, i)
          : <Text key={i} as={b.kind} variant={caption ? 'footnote' : 'body'} style={{ margin: 0, paddingInlineStart: '1.4em' }}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</Text>)}
    </Stack>
  );
}

/* ---- Row, Column: Stack with the spacing scale's 8 and 12 px */
const JUSTIFY: Record<string, CSSProperties['justifyContent']> = {
  start: 'flex-start', center: 'center', end: 'flex-end', spaceBetween: 'space-between', spaceAround: 'space-around', spaceEvenly: 'space-evenly', stretch: 'stretch',
};
const ALIGN: Record<string, CSSProperties['alignItems']> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
export const a2uiFlow = (direction: 'row' | 'column') => function A2uiFlow({ props, buildChild, context }: Rendered<{ children?: Child[]; justify?: string; align?: string }>) {
  /* a stretched, unweighted Column that is a Card's child: its first and last children sit at the card's edges */
  const edge = useContext(EdgeContext);
  const atEdge = direction === 'column' && edge?.id === context.componentModel.id && edge.edge === 'all' && (props.align ?? 'stretch') === 'stretch' && !props.weight;
  const list = props.children ?? [];
  /* the children's IDs as the agent wrote them, in the same order (a template is not a list of IDs: no edges) */
  const raw = context.componentModel.properties.children;
  const ids = Array.isArray(raw) && raw.length === list.length ? raw.map(String) : null;
  const edgeOf = (i: number): Edge | null => (i === 0 && i === list.length - 1 ? 'all' : i === 0 ? 'top' : i === list.length - 1 ? 'bottom' : null);
  /* the children's IDs as the agent wrote them (the binder hands its own node IDs), a template's instances by the
     template's component ID, for the slots below */
  const members = ids ?? (raw && typeof raw === 'object' && 'componentId' in raw ? [String((raw as { componentId: unknown }).componentId)] : []);
  const slot = useSlot({ props, buildChild, context } as Rendered<unknown>);
  /* a weighted Column that is a Row's own child is a panel: it keeps a minimum width, so a narrow Row stacks it */
  const panel = direction === 'column' && !!props.weight && props.weight > 0 && slot.inRow;
  const align = props.align ?? 'stretch';   /* the catalog's default, for both */
  /* a Row stays on one line, its text giving way, as the catalog draws it; it wraps only to stack its panels (which
     keep their minimum) or to move whole buttons of an action row to another line */
  /* a template's instances count one by one (six Buttons from one template are a Row of Buttons) */
  const given = useChildKinds(context, members);
  const kinds = ids || !given.length ? given : list.map(() => given[0]);
  /* a feature image beside other content: the content goes below it when there is no room beside it */
  /* (a missing variant is the catalog's default, mediumFeature; an unweighted Column beside it is its text) */
  const media = direction === 'row' && kinds.some((k) => k.type === 'Image' && k.feature) && kinds.some((k) => k.type === 'Column' && !k.weight);
  /* a Row with no `align` and no panels lines its children up by their first baselines: a caption beside a button's
     label, a small price beside a large one. The catalog's stretch would put them at the top; with panels (or a
     Column or Card beside them) it stays, so the boxes keep one height */
  const rowAlign = direction === 'row' && props.align === undefined && !kinds.some((k) => k.type === 'Column' || k.type === 'Card' || k.type === 'List') ? 'baseline' : undefined;
  /* a Column of texts only (a name and its caption) reads as one block: a tight gap */
  const textOnly = direction === 'column' && kinds.length >= 2 && kinds.every((k) => k.type === 'Text');
  const wrap = direction === 'row' && (media || kinds.some((k) => (k.type === 'Column' || k.type === 'Card') && k.weight > 0) || (kinds.length >= 2 && kinds.every((k) => k.type === 'Button')));
  /* a Row that spreads its children takes its Column's width whatever its alignment (a nested Column keeps its own
     width, so a centred block of rows stays centred) */
  const spread = direction === 'row' && ['spaceBetween', 'spaceAround', 'spaceEvenly'].includes(props.justify ?? '');
  const style: CSSProperties = {
    ...grow(props.weight), ...(panel ? { minWidth: PANEL_MIN } : {}),
    ...(slot.inColumn && spread ? { alignSelf: 'stretch' } : {}),
    /* the text beside a feature image takes the rest of the line, and goes below the image under 9rem: a large picture
       sends it below on a phone, a thumbnail keeps it beside (#98 review: 15rem sent a 50 px cover's title below) */
    ...(slot.mediaRow && !props.weight && direction === 'column' ? { flex: `1 1 ${MEDIA_TEXT_MIN}`, minWidth: 0 } : {}),
    /* unweighted in a Row, it may give way below its content, its text wrapping inside it rather than running over
       its neighbours when the Row is too narrow for all of them */
    ...(slot.inRow && !props.weight ? { minWidth: 0 } : {}),
    /* spread in a centred (or start or end) Column: around or evenly, each item has a slot of up to 6rem, so a few
       numbers do not drift to the card's edges; between, the ends meet the Column's (a track's) ends */
    ...(slot.inColumn && (props.justify === 'spaceAround' || props.justify === 'spaceEvenly') && slot.align !== 'stretch'
      ? { width: `min(100%, ${Math.max(1, list.length) * 6}rem)`, alignSelf: undefined } : {}),
  };
  /* a table: a Row of two or more weighted cells (and no panels) is one row of it. It works out the width at which
     each cell gets its share by weight without breaking its longest word or number, and the nearest Column gives
     every such row the largest of these, scrolling sideways when that is wider than itself: columns stay in line
     from row to row and with a header row, and an amount is never split */
  const gridRow = direction === 'row' && !wrap && kinds.filter((k) => k.weight > 0).length >= 2;
  const table = useContext(TableContext);
  const box = useRef<HTMLDivElement>(null);
  useTableRow(gridRow ? table : null, box);
  const [need, setNeed] = useState(0);
  const host = useTableHost(direction === 'column', setNeed);
  if (gridRow) Object.assign(style, { minWidth: 'var(--a2ui-table-min, 0px)' });
  /* a Column holding table rows gives them its shared minimum and scrolls when it is narrower. Only while it is (more
     of the table waits beyond an edge) is it a named region in the Tab order that takes the arrow keys */
  const scrolls = direction === 'column' && need > 0;
  const [overflows, setOverflows] = useState(false);
  /* the edges where more of the table waits fade out (24 px), as Satin's strips of tabs do. Written straight to the
     table's own style as it scrolls: a render (and the rows' measuring) mid-scroll would stop a trackpad's momentum.
     Whether it overflows at all changes only with a size, never with the scroll, so that render does not come
     mid-scroll */
  useLayoutEffect(() => {
    const el = box.current;
    if (!scrolls || !el) { setOverflows(false); return; }
    let s = '', e = '', o: boolean | null = null;
    const update = () => {
      const rtl = getComputedStyle(el).direction === 'rtl', max = el.scrollWidth - el.clientWidth, at = Math.abs(el.scrollLeft);
      const before = at > 1, after = at < max - 1;
      const ns = (rtl ? after : before) ? '24px' : '0px', ne = (rtl ? before : after) ? '24px' : '0px';
      if (ns !== s) { s = ns; el.style.setProperty('--a2ui-fade-s', ns); }
      if (ne !== e) { e = ne; el.style.setProperty('--a2ui-fade-e', ne); }
      if (max > 1 !== o) { o = max > 1; setOverflows(o); }
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); };
  }, [scrolls, need]);
  const env = useEnv();
  if (scrolls) {
    const mask = 'linear-gradient(to right, transparent, #000 var(--a2ui-fade-s, 0px), #000 calc(100% - var(--a2ui-fade-e, 0px)), transparent)';
    /* its focus ring inside its box: the mask hides anything painted outside it. A flick past its end stops there
       (as Satin's DataTable): it does not carry on into the sheet or page around it */
    Object.assign(style, { '--a2ui-table-min': `${need}px`, overflowX: 'auto', overflowY: 'hidden', overscrollBehaviorX: 'contain', maskImage: mask, WebkitMaskImage: mask, outlineOffset: -2 });
  }
  const stack = (
    <Stack ref={box} direction={direction} gap={direction === 'row' ? 2 : textOnly ? 1 : 3} justify={JUSTIFY[props.justify ?? 'start']} data-a2ui-panel={panel ? '' : undefined}
      data-a2ui-table={scrolls ? '' : undefined} align={rowAlign ?? ALIGN[align]} wrap={wrap} style={style}
      /* a table that scrolls takes the keyboard and says what it is: ← and → move it 40 px, Home and End to its ends
         (WebKit does not scroll a focused box with the arrow keys itself); only when the table itself has the focus */
      {...(scrolls && overflows ? { tabIndex: 0, role: 'region', 'aria-label': env.words.scrollTable, onKeyDown: (ev: ReactKeyboardEvent<HTMLDivElement>) => {
        const el = ev.currentTarget;
        if (ev.target !== el || ev.altKey || ev.ctrlKey || ev.metaKey) return;
        const rtl = getComputedStyle(el).direction === 'rtl', max = el.scrollWidth - el.clientWidth;
        const to = ev.key === 'ArrowRight' ? el.scrollLeft + 40 : ev.key === 'ArrowLeft' ? el.scrollLeft - 40
          : ev.key === 'Home' ? 0 : ev.key === 'End' ? (rtl ? -max : max) : null;
        if (to === null) return;
        ev.preventDefault();
        el.scrollLeft = to;
      } } : {})}>
      {/* every child in the same keyed wrapper whether or not the Column is at a card's edge: a change of `align` or
          `weight` moves the edge, and must not remount the children (their focus and own state) */}
      {list.map((c, i) => {
        const e = atEdge && ids && typeof c === 'string' ? edgeOf(i) : null;   /* a templated child is one of many: no edge */
        const key = typeof c === 'string' ? c : `${c.id}@${c.basePath}`;
        return <EdgeContext.Provider key={key} value={e && ids ? { id: ids[i], edge: e } : null}>{typeof c === 'string' ? buildChild(c) : buildChild(c.id, c.basePath)}</EdgeContext.Provider>;
      })}
    </Stack>
  );
  const inner = <FlowContext.Provider value={{ direction, ids: members, align, aligned: props.align !== undefined, media }}>{stack}</FlowContext.Provider>;
  const flow = host ? <TableContext.Provider value={host}>{inner}</TableContext.Provider> : inner;
  return direction === 'row' ? <RowContext.Provider value={members}>{flow}</RowContext.Provider> : flow;
};

/* the component types and weights of a flow's children, read from the surface's model, and read again when a child
   arrives, changes or goes (they stream in after their parent) */
function useChildKinds(context: Rendered<unknown>['context'], ids: string[]) {
  const [, bump] = useState(0);
  const key = ids.join('\u0000');
  useEffect(() => {
    const model = context.surfaceComponents;
    if (!model) return;
    const mine = new Set(ids);
    /* each child's updates, followed from when it exists: also a child that arrives (or comes back) later */
    const follow = new Map<string, { unsubscribe(): void }>();
    const watch = (id: string) => {
      follow.get(id)?.unsubscribe();
      const sub = model.get(id)?.onUpdated?.subscribe(() => bump((n) => n + 1));
      if (sub) follow.set(id, sub); else follow.delete(id);
    };
    ids.forEach(watch);
    const subs = [
      model.onCreated?.subscribe((c) => { if (mine.has(c.id)) { watch(c.id); bump((n) => n + 1); } }),
      model.onDeleted?.subscribe((id) => { if (mine.has(id)) { follow.get(id)?.unsubscribe(); follow.delete(id); bump((n) => n + 1); } }),
    ].filter((x): x is { unsubscribe(): void } => !!x);
    return () => { subs.forEach((x) => x.unsubscribe()); follow.forEach((x) => x.unsubscribe()); };
  }, [context.surfaceComponents, key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return ids.map((id) => {
    const c = context.surfaceComponents?.get(id);
    const w = Number(c?.properties?.weight);
    const variant = c?.properties?.variant;
    return { type: c?.type ?? '', weight: Number.isFinite(w) ? w : 0, feature: variant === undefined || variant === 'mediumFeature' || variant === 'largeFeature' };
  });
}

/* a table's rows report the width they need to their Column */
type TableHost = { report: (key: object, width: number) => void; drop: (key: object) => void };
const TableContext = createContext<TableHost | null>(null);
function useTableHost(on: boolean, setNeed: (n: number) => void): TableHost | null {
  const needs = useRef(new Map<object, number>());
  return useMemo(() => (on ? {
    report: (key, width) => { needs.current.set(key, width); setNeed(Math.ceil(Math.max(0, ...needs.current.values()))); },
    drop: (key) => { needs.current.delete(key); setNeed(Math.ceil(Math.max(0, ...needs.current.values()))); },
  } : null), [on]);   // eslint-disable-line react-hooks/exhaustive-deps
}
/* the cells of a row, through the binder's display: contents wrappers */
function cells(row: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const c of Array.from(row.children) as HTMLElement[]) {
    if (getComputedStyle(c).display === 'contents') out.push(...cells(c)); else out.push(c);
  }
  return out;
}
function useTableRow(table: TableHost | null, box: { current: HTMLDivElement | null }) {
  useLayoutEffect(() => {
    const row = box.current;
    if (!table || !row || typeof getComputedStyle !== 'function') return;
    const key = {};
    const measure = () => {
      const cs = getComputedStyle(row), gap = parseFloat(cs.columnGap) || 0, list = cells(row);
      let fixed = gap * Math.max(0, list.length - 1), total = 0;
      const weighted: { el: HTMLElement; w: number }[] = [];
      for (const el of list) {
        const w = parseFloat(getComputedStyle(el).flexGrow) || 0;
        if (w > 0) { weighted.push({ el, w }); total += w; } else fixed += el.offsetWidth;
      }
      let need = 0;
      for (const { el, w } of weighted) {
        /* the cell's narrowest width that breaks no word: measured at min-content, then put back; and at least what
           it shows now when its content runs over it (an unbreakable number wider than its share). All in layout
           pixels (offsetWidth, scrollWidth), never the screen's: under a scale (a preview drawn smaller) the two
           differ, and mixing them would resize the table on every measure */
        const over = el.scrollWidth > el.clientWidth ? el.scrollWidth : 0;
        const was = el.style.cssText;
        el.style.flex = 'none'; el.style.width = 'min-content'; el.style.minWidth = '0';
        const mc = Math.max(el.offsetWidth, over);
        el.style.cssText = was;
        need = Math.max(need, (mc * total) / w);
      }
      /* + 1: offsetWidth rounds, and a cell a hair too narrow would let its number run over */
      table.report(key, need + fixed + parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0') + 1);
    };
    measure();
    /* again when a cell's text changes (data arrives), when a web font finishes loading, and when the row's size
       changes (a font's glyphs arriving late change it): the measure does not depend on the row's width, so it settles */
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure);
    mo?.observe(row, { childList: true, subtree: true, characterData: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    ro?.observe(row);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fonts?.addEventListener?.('loadingdone', measure);
    /* only while this row is still in this table: the node outlives its place in a table (its cells lose their
       weights, or it moves), and a late report would bring a dropped width back */
    let live = true;
    void fonts?.ready?.then(() => { if (live && box.current === row) measure(); });
    return () => { live = false; mo?.disconnect(); ro?.disconnect(); fonts?.removeEventListener?.('loadingdone', measure); table.drop(key); };
  }, [table]);   // eslint-disable-line react-hooks/exhaustive-deps
}

/* ---- List: a list (its items are list items), vertical or horizontal; it scrolls along its direction when its
   container constrains it, and a horizontal one that overflows takes the keyboard (arrow keys scroll it) */
export function A2uiList({ props, buildChild }: Rendered<{ children?: Child[]; direction?: string; align?: string; listStyle?: string }>) {
  const across = props.direction === 'horizontal';
  const ordered = props.listStyle === 'ordered', marked = ordered || props.listStyle === 'unordered';
  const el = useRef<HTMLUListElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const e = el.current;
    if (!e || !across) return;
    const check = () => setOverflows(e.scrollWidth > e.clientWidth + 1);
    check();
    /* the box's size, and its content: a late or wider child can make it overflow without the box changing size */
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(e);
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(check);
    mo?.observe(e, { childList: true, subtree: true, characterData: true });
    return () => { ro?.disconnect(); mo?.disconnect(); };
  }, [across]);
  const Tag = ordered ? 'ol' : 'ul';
  const sent = props.children ?? [];
  return (
    <Tag ref={el as never} role="list" tabIndex={across && overflows ? 0 : undefined}
      style={{
        /* room for a card's shadow inside the scrolling box, given back outside it, so nothing moves */
        margin: -4, padding: 4, ...(marked && !across ? { paddingInlineStart: 'calc(1.4em + 4px)' } : {}), listStyle: marked && !across ? (ordered ? 'decimal' : 'disc') : 'none',
        display: 'flex', flexDirection: across ? 'row' : 'column', gap: across ? 'var(--sg-space-2, 8px)' : 'var(--sg-space-3, 12px)', alignItems: ALIGN[props.align ?? 'stretch'],
        overflow: 'auto', minHeight: 0, minWidth: across ? 0 : 'calc(var(--a2ui-table-min, 0px) + 8px)', scrollbarWidth: across ? 'none' : undefined, ...grow(props.weight),
      }}>
      {sent.map((c) => {
        const key = typeof c === 'string' ? c : `${c.id}@${c.basePath}`;
        return <Item key={key} across={across}>{typeof c === 'string' ? buildChild(c) : buildChild(c.id, c.basePath)}</Item>;
      })}
    </Tag>
  );
}

/* a list item that stays hidden while its child has not been sent (an unsent child draws nothing): no gap, no marker,
   nothing announced; it shows when the child arrives */
function Item({ across, children }: { across: boolean; children: ReactNode }) {
  const el = useRef<HTMLLIElement>(null);
  const [empty, setEmpty] = useState(false);
  useLayoutEffect(() => {
    const li = el.current;
    if (!li) return;
    const check = () => setEmpty(li.childNodes.length === 0);
    check();
    if (typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(check); mo.observe(li, { childList: true });
    return () => mo.disconnect();
  }, []);
  return <li ref={el} hidden={empty} style={across ? { flex: '0 0 auto', maxWidth: '85%' } : undefined}>{children}</li>;
}

/* the outermost Card is Satin's surface card; one inside it keeps to the same level with a hairline */
export function A2uiCard({ props, buildChild, context }: Rendered<{ child?: string }>) {
  const depth = useContext(CardDepthContext);
  /* the child's ID as the agent wrote it (the binder hands `child` over as its own node ID) */
  const childId = context.componentModel.properties.child;
  const row = useContext(RowContext);
  const panel = !!props.weight && props.weight > 0 && !!row?.includes(context.componentModel.id);
  return (
    <Card variant={depth ? 'outlined' : undefined} data-a2ui-panel={panel ? '' : undefined} style={panel ? { ...grow(props.weight), minWidth: PANEL_MIN } : grow(props.weight)}>
      <CardBody>
        <CardDepthContext.Provider value={depth + 1}>
          <EdgeContext.Provider value={typeof childId === 'string' ? { id: childId, edge: 'all' } : null}>{props.child ? buildChild(props.child) : null}</EdgeContext.Provider>
        </CardDepthContext.Provider>
      </CardBody>
    </Card>
  );
}

export function A2uiDivider({ props }: Rendered<{ axis?: string }>) {
  return <Divider vertical={props.axis === 'vertical'} style={props.axis === 'vertical' ? { alignSelf: 'stretch', height: 'auto' } : undefined} />;
}

/* ---- Tabs: Satin's underline tabs; each tab's child is its panel */
export function A2uiTabs({ props, buildChild }: Rendered<{ tabs?: { title?: unknown; child?: string }[] }>) {
  const tabs = props.tabs ?? [];
  const [value, setValue] = useState('0');
  return (
    <div style={{ minWidth: 0, ...grow(props.weight) }}>
      <Tabs value={value} onChange={setValue} items={tabs.map((tab, i) => ({
        value: String(i), label: tab.title == null ? '' : String(tab.title), content: tab.child ? buildChild(tab.child) : null,
      }))} />
    </div>
  );
}

/* ---- Modal: its trigger opens a Satin Dialog (focus trap, layer stack, Escape, focus back). The trigger keeps its own
   action. A2UI gives a modal no title; Satin's dialog needs one, so it takes the modal's label, else a built-in word
   (with a diagnostic). */
export function A2uiModal(r: Rendered<{ trigger?: string; content?: string }>) {
  const { props, buildChild, context } = r;
  const env = useEnv();
  useHostSink(r);
  const [open, setOpen] = useState(false);
  const { label } = agentA11y(r);
  /* a trigger with nothing that takes the keyboard (text, an image) becomes a button itself: the same element, so the
     trigger can be streamed in and replaced without moving, and gets role="button", a tab stop and Enter and Space.
     A trigger that holds a control (a Button, or a Row with one) is left as it is, and one that shows nothing is not
     made a blank button. Judged again whenever the trigger's content changes. */
  const slot = useRef<HTMLSpanElement>(null);
  const [inert, setInert] = useState(false);
  useLayoutEffect(() => {
    const el = slot.current;
    if (!el) return;
    const check = () => {
      const control = el.querySelector('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role=button]');
      const visible = !!el.textContent?.trim() || !!el.querySelector('img[alt]:not([alt=""]), svg[role=img]');
      setInert(!control && visible);
    };
    check();
    if (typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(check); mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['alt', 'tabindex', 'role'] });
    return () => mo.disconnect();
  }, []);
  const openKey = (e: { key: string; preventDefault: () => void }) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } };
  const warned = useRef(false);
  useLayoutEffect(() => {
    if (label || warned.current) return;
    warned.current = true;
    env.warn({ code: 'untitled-modal', componentId: context.componentModel.id, message: 'A modal without an accessibility label: its dialog is titled with a generic word.' });
  });
  return (
    <Fragment>
      {/* the trigger is whatever the agent made it (usually a Button): a click, or Enter and Space on it, opens the dialog */}
      <span ref={slot} onClick={() => setOpen(true)} {...(inert
        ? { role: 'button', tabIndex: 0, onKeyDown: openKey, className: 'sg-a2ui-trigger', style: { display: 'inline-flex', cursor: 'pointer', borderRadius: 'var(--sg-radius-sm)', maxWidth: '100%' } }
        : { style: { display: 'contents' } })}>
        <InTriggerContext.Provider value={true}>{props.trigger ? buildChild(props.trigger) : null}</InTriggerContext.Provider>
      </span>
      <Dialog open={open} onClose={() => setOpen(false)} title={label ?? env.words.dialog} role="dialog" dismissible
        actions={<Button variant="tinted" onClick={() => setOpen(false)}>{env.words.close}</Button>}>
        {/* an overlay: its first Card is the outermost again */}
        <CardDepthContext.Provider value={0}>{props.content ? buildChild(props.content) : null}</CardDepthContext.Provider>
      </Dialog>
    </Fragment>
  );
}
