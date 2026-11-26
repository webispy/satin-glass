/* Text, Row, Column, List, Card, Divider, Tabs and Modal of the A2UI basic catalog, drawn with Satin controls. */
import { Fragment, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, Card, CardBody, Dialog, Divider, Stack, Tabs, Text } from '@satin-glass/react';
import { agentA11y, CardDepthContext, EdgeContext, grow, InButtonContext, InTriggerContext, PANEL_MIN, RowContext, useEnv, useHostSink, type Child, type Edge, type Rendered } from './shared';

/* ---- Text: the catalog's basic Markdown — headings, bold, italics, inline code, lists and paragraphs. No HTML, and
   links and images are their text only, as the catalog allows. v0.9.1 names headings with `variant` h1–h5. */
const HEADING = ['body', 'title-1', 'title-2', 'title-3', 'headline', 'headline', 'headline'] as const;
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
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
  return out;
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
export function A2uiText({ props }: Rendered<{ text?: unknown; variant?: string }>) {
  const inButton = useContext(InButtonContext);
  const raw = props.text == null ? '' : String(props.text);
  const caption = props.variant === 'caption';
  const vh = /^h([1-5])$/.exec(props.variant ?? '');
  const style: CSSProperties = { ...grow(props.weight), overflowWrap: 'anywhere' };
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
  /* a weighted Column that is a Row's own child is a panel: it keeps a minimum width, so a narrow Row stacks it */
  const row = useContext(RowContext);
  const panel = direction === 'column' && !!props.weight && props.weight > 0 && !!row?.includes(context.componentModel.id);
  const stack = (
    <Stack direction={direction} gap={direction === 'row' ? 2 : 3} justify={JUSTIFY[props.justify ?? 'start']} data-a2ui-panel={panel ? '' : undefined}
      align={ALIGN[props.align ?? (direction === 'row' ? 'center' : 'stretch')]} wrap={direction === 'row'} style={panel ? { ...grow(props.weight), minWidth: PANEL_MIN } : grow(props.weight)}>
      {/* every child in the same keyed wrapper whether or not the Column is at a card's edge: a change of `align` or
          `weight` moves the edge, and must not remount the children (their focus and own state) */}
      {list.map((c, i) => {
        const e = atEdge && ids && typeof c === 'string' ? edgeOf(i) : null;   /* a templated child is one of many: no edge */
        const key = typeof c === 'string' ? c : `${c.id}@${c.basePath}`;
        return <EdgeContext.Provider key={key} value={e && ids ? { id: ids[i], edge: e } : null}>{typeof c === 'string' ? buildChild(c) : buildChild(c.id, c.basePath)}</EdgeContext.Provider>;
      })}
    </Stack>
  );
  return direction === 'row' ? <RowContext.Provider value={Array.isArray(ids) ? ids : null}>{stack}</RowContext.Provider> : stack;
};

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
        overflow: 'auto', minHeight: 0, minWidth: 0, scrollbarWidth: across ? 'none' : undefined, ...grow(props.weight),
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
