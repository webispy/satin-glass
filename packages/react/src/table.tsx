/* DataTable (0.3): the workhorse of analytical dashboards.
   - columns with groups ("General / Knowledge / Cost"), a second header line (units, sample size) and an
     explanation on hover / focus; numbers align to the end in tabular figures
   - sort (asc → desc → off; empty values always last), or leave sorting to the server (manualSort)
   - selection with a header checkbox (indeterminate), Shift-click ranges, Space, Ctrl/Cmd+A
   - pinned summary rows above the data (best / median / worst), sticky header and sticky first columns
   - thousands of rows: inside a maxHeight the body is virtualised (fixed row height per density)
   - WAI-ARIA grid: one tab stop, arrow keys between cells, Home/End, Ctrl+Home/End, PageUp/PageDown;
     a cell with a single control (link, button, checkbox) hands focus to it
   - loading (skeleton rows / dimmed rows with a progress line) and an empty state */
import {
  Fragment, useEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { cx, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { Tooltip } from './feedback';
import { Skeleton } from './skeleton';
import { Checkbox } from './selection';
import { Button, type ButtonVariant } from './controls';
import { Popover } from './overlays';
import { messagesFor, useLocaleOf, useMessages } from './messages';

export type SortDir = 'asc' | 'desc';
export type SortState = { key: string; dir: SortDir } | null;

export type Column<T> = {
  /** identifies the column (sorting, hiding, React keys); also the row field shown when there is no `render` */
  key: string;
  /** the column's title in the header */
  header: ReactNode;
  /** second header line: units, sample size… */
  subheader?: ReactNode;
  /** what the column means (shown on hover / focus of the header) */
  description?: ReactNode;
  /** consecutive columns with the same group share a header above them */
  group?: string;
  /** width in px (default 120); the table is as wide as its columns and scrolls sideways when narrower */
  width?: number;
  /** where the content sits; numbers usually go at the end, in tabular figures */
  align?: 'start' | 'center' | 'end';
  /** the header becomes a button that sorts by this column (ascending, descending, off) */
  sortable?: boolean;
  /** first direction when sorting by this column (numbers where higher is better: 'desc') */
  firstSort?: SortDir;
  /** value to sort by (default: row[key]) */
  value?: (row: T) => unknown;
  /** the cell's content (default: `row[key]`); `pinned` is true in a summary row */
  render?: (row: T, ctx: { index: number; selected: boolean; pinned: boolean }) => ReactNode;
  /** stays in view when the table scrolls sideways (leading columns only) */
  sticky?: boolean;
  /** can be hidden from a ColumnChooser (default: yes, except sticky columns — they say which row is which) */
  hideable?: boolean;
};

export type DataTableProps<T> = {
  /** the rows, in the order shown when nothing is sorted */
  rows: T[];
  /** the columns, left to right */
  columns: Column<T>[];
  /** keys of columns not shown (a ColumnChooser edits this); a hidden sorted column stops sorting */
  hiddenColumns?: string[];
  /** a stable key per row (selection and focus follow it through sorting and filtering) */
  rowKey: (row: T) => string;
  /** names the table for assistive technology */
  'aria-label': string;
  /** the sorted column and direction, or null (controlled; use with `onSortChange`) */
  sort?: SortState;
  /** the starting sort when uncontrolled */
  defaultSort?: SortState;
  /** called with the new sort when a header is pressed */
  onSortChange?: (s: SortState) => void;
  /** rows are already sorted (by a server): only report sort changes */
  manualSort?: boolean;
  /** a checkbox column for choosing rows (Shift-click for a range, Space, Ctrl/Cmd+A) */
  selectable?: boolean;
  /** keys of the chosen rows (controlled; use with `onSelectedChange`) */
  selected?: string[];
  /** the keys chosen at first when uncontrolled */
  defaultSelected?: string[];
  /** called with the chosen keys whenever they change */
  onSelectedChange?: (keys: string[]) => void;
  /** vertical lines between columns: where the header group changes, or between every column (default none) */
  columnLines?: 'none' | 'groups' | 'all';
  /** summary rows above the data; not sorted, not selectable */
  pinnedRows?: T[];
  /** row height for repeated rows: 44 px regular, 36 px compact */
  density?: 'compact' | 'regular';
  /** the table scrolls inside this height (sticky header; virtualised beyond ~80 rows) */
  maxHeight?: number | string;
  /** shows skeleton rows when there are none yet, or dims the rows with a progress line over them */
  loading?: boolean;
  /** what to show when there are no rows (an EmptyState, usually) */
  empty?: ReactNode;
  /** makes rows actionable: called on a click or on Enter in the row */
  onRowClick?: (row: T) => void;
  /** total rows on the server (for screen readers when paging) */
  rowCount?: number;
  /** extra props per row: muted (e.g. too few samples) */
  rowState?: (row: T) => { muted?: boolean } | undefined;
  /** BCP 47 locale for the default text sort and the words the table writes (default: the ThemeProvider's `locale`,
      else 'en-US') */
  locale?: string;
  labels?: { selectAll?: string; selectRow?: (row: T) => string; empty?: string; sortedAsc?: string; sortedDesc?: string };
  className?: string; style?: CSSProperties;
};

const ROW_H = { compact: 36, regular: 44 };
const SEL_W = 44, DEFAULT_W = 120, OVERSCAN = 8, VIRTUAL_FROM = 80, FLING_SETTLE = 120;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]';
/* controls inside cells that are still in the tab order */
const INNER_TABBABLE = ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]'].map((s) => `[data-r] ${s}:not([tabindex="-1"])`).join(', ');

/* text sorts the locale's way, digits by value ("item 2" before "item 10"), ignoring case and accents */
const collators = new Map<string, Intl.Collator>();
const collatorFor = (locale: string) => {
  let c = collators.get(locale);
  if (!c) { c = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' }); collators.set(locale, c); }
  return c;
};
const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v)) || (v instanceof Date && isNaN(v.getTime()));
function compareValues(a: unknown, b: unknown, collator: Intl.Collator): number {
  const ea = isEmpty(a), eb = isEmpty(b);
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;   /* handled again below so empties stay last in both directions */
  /* one order across types (numbers, then dates by time — as text they sorted by weekday name — then the rest as
     text), so a mixed column sorts the same whatever order its rows come in */
  const rank = (v: unknown) => (typeof v === 'number' ? 0 : v instanceof Date ? 1 : 2), ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return (a as number) - (b as number);
  if (ra === 1) return (a as Date).getTime() - (b as Date).getTime();
  return collator.compare(String(a), String(b));
}

export function DataTable<T>({
  rows, columns: allColumns, hiddenColumns, rowKey, 'aria-label': label, sort, defaultSort = null, onSortChange, manualSort, selectable,
  selected, defaultSelected = [], onSelectedChange, pinnedRows = [], columnLines = 'none', density = 'regular', maxHeight, loading, empty,
  onRowClick, rowCount, rowState, locale: localeProp, labels = {}, className, style,
}: DataTableProps<T>) {
  const locale = useLocaleOf(localeProp), t = messagesFor(locale).table;
  const [sortState, setSort] = useControllable<SortState>(sort, defaultSort, onSortChange);
  const [sel, setSel] = useControllable<string[]>(selected, defaultSelected, onSelectedChange);
  const selSet = useMemo(() => new Set(sel), [sel]);
  const box = useRef<HTMLDivElement>(null), head = useRef<HTMLTableSectionElement>(null), pin = useRef<HTMLTableSectionElement>(null);
  const id = useStableId('sg-table');
  const rowH = ROW_H[density];
  const columns = useMemo(() => { if (!hiddenColumns?.length) return allColumns; const off = new Set(hiddenColumns); return allColumns.filter((c) => !off.has(c.key)); }, [allColumns, hiddenColumns]);
  /* hiding the sorted column ends that sort (rows would stay ordered by something no longer on screen) */
  const sortHidden = !!sortState && !!hiddenColumns?.includes(sortState.key);
  useEffect(() => { if (sortHidden) setSort(null); }, [sortHidden]);

  /* ---- sorting (stable; empty values last whichever the direction) */
  const sorted = useMemo(() => {
    if (manualSort || !sortState) return rows;
    const col = columns.find((c) => c.key === sortState.key);
    if (!col) return rows;
    const get = col.value ?? ((r: T) => (r as Record<string, unknown>)[col.key]);
    const sign = sortState.dir === 'asc' ? 1 : -1, collator = collatorFor(locale);
    return rows.map((r, i) => ({ r, i, v: get(r) })).sort((a, b) => {
      const ea = isEmpty(a.v), eb = isEmpty(b.v);
      if (ea || eb) return ea === eb ? a.i - b.i : ea ? 1 : -1;
      return sign * compareValues(a.v, b.v, collator) || a.i - b.i;
    }).map((x) => x.r);
  }, [rows, columns, sortState, manualSort, locale]);
  const nextSort = (c: Column<T>) => {
    const first = c.firstSort ?? 'asc', other = first === 'asc' ? 'desc' : 'asc';
    if (!sortState || sortState.key !== c.key) return setSort({ key: c.key, dir: first });
    if (sortState.dir === first) return setSort({ key: c.key, dir: other });
    setSort(null);
  };

  /* ---- selection: the range anchor is a row's key, so sorting or filtering cannot move it to another row */
  const anchor = useRef<string | null>(null);
  const keys = useMemo(() => sorted.map(rowKey), [sorted, rowKey]);
  const allOn = keys.length > 0 && keys.every((k) => selSet.has(k));
  const someOn = !allOn && keys.some((k) => selSet.has(k));
  const toggleRow = (i: number, range: boolean) => {
    const k = keys[i], at = anchor.current === null ? -1 : keys.indexOf(anchor.current);
    if (range && at >= 0) {
      const [a, b] = [Math.min(at, i), Math.max(at, i)];
      const on = !selSet.has(k) || selSet.has(anchor.current!);
      const next = new Set(sel);
      for (let j = a; j <= b; j++) on ? next.add(keys[j]) : next.delete(keys[j]);
      setSel([...next]);
    } else setSel(selSet.has(k) ? sel.filter((x) => x !== k) : [...sel, k]);
    anchor.current = k;
  };
  /* a Set: a search of every key per selected key took seconds on large selections */
  const toggleAll = () => { if (!allOn) return setSel([...new Set([...sel, ...keys])]); const off = new Set(keys); setSel(sel.filter((k) => !off.has(k))); };

  /* ---- columns: selection column first; sticky offsets */
  const cols = columns;
  const C = cols.length + (selectable ? 1 : 0);
  const widths = [...(selectable ? [SEL_W] : []), ...cols.map((c) => c.width ?? DEFAULT_W)];
  const stickyLeft: (number | undefined)[] = [];
  { let acc = 0, on = true; widths.forEach((w, i) => { const col = selectable ? (i === 0 ? null : cols[i - 1]) : cols[i]; const st = on && (col === null || col.sticky); stickyLeft.push(st ? acc : undefined); if (st) acc += w; else on = false; }); }
  const stickyCount = stickyLeft.filter((x) => x !== undefined).length;
  const lastSticky = stickyCount > (selectable ? 1 : 0) ? stickyCount - 1 : -1;
  const groups = cols.some((c) => c.group);
  const anySub = cols.some((c) => c.subheader);
  const stickyW = widths.reduce((a, w, i) => a + (stickyLeft[i] !== undefined ? w : 0), 0);
  /* a line at the end of a column (by data column; from the columns shown, so hiding one moves it) */
  const lineAfter = (ci: number) => ci < cols.length - 1 && (columnLines === 'all' || (columnLines === 'groups' && (cols[ci].group || '') !== (cols[ci + 1].group || '')));
  const colClass = (colIdx: number, ci: number) => cx(stickyLeft[colIdx] !== undefined && 'sg-table__sticky', colIdx === lastSticky && 'sg-table__sticky--last', lineAfter(ci) && 'sg-table__vline');

  /* ---- virtual window */
  const virtual = maxHeight !== undefined && sorted.length > VIRTUAL_FROM;
  const [win, setWin] = useState({ start: 0, end: Math.min(sorted.length, 40) });
  const measure = () => {
    const b = box.current;
    if (!b || !virtual) return;
    const top = (head.current?.offsetHeight ?? 0) + (pin.current?.offsetHeight ?? 0);
    const start = Math.max(0, Math.floor((b.scrollTop - top) / rowH) - OVERSCAN);
    const end = Math.min(sorted.length, Math.ceil((b.scrollTop - top + b.clientHeight) / rowH) + OVERSCAN);
    setWin((w) => (w.start === start && w.end === end ? w : { start, end }));
  };
  useIsoLayoutEffect(measure, [virtual, sorted.length, rowH]);
  /* the observer calls the latest measure: the first render's kept its row height and row count */
  const measureRef = useRef(measure); measureRef.current = measure;
  useEffect(() => {
    if (!virtual || typeof ResizeObserver === 'undefined' || !box.current) return;
    const ro = new ResizeObserver(() => measureRef.current()); ro.observe(box.current);
    return () => ro.disconnect();
  }, [virtual]);
  const range = virtual ? win : { start: 0, end: sorted.length };
  /* the window follows the scroll once per frame, just before the frame is drawn: a fast wheel or fling sends several
     scroll events a frame, and a window rendered for each was replaced before it was seen (three renders a frame on a
     fast wheel). Rendered there rather than left to React's scheduler, which would render it in a task of its own
     after that frame, and the frame would show the old window. */
  const frame = useRef(0);
  /* a fling: a frame that scrolled half the box or more draws the window's rows as one still placeholder (a tall row
     whose cells repeat, every row height, the row's line and a bar where each column's text runs), and the rows are
     rendered once no such frame has come for FLING_SETTLE ms. Rendering a window of rows that will not be read, frame
     after frame, is more than a frame holds on slower machines. Never while the grid holds the focus (the focused cell
     stays), and never in forced colours, which take the placeholder's gradients away and would leave the body blank;
     focus coming in, or a press, ends it at once. */
  const [flinging, setFlinging] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTop = useRef(0);
  const endFling = () => { clearTimeout(settle.current); settle.current = undefined; setFlinging(false); };
  const onScroll = virtual ? () => {
    /* the latest measure when the frame comes: the row height or row count may have changed since the scroll */
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      flushSync(() => {
        const b = box.current;
        measureRef.current();
        if (!b) return;
        const moved = Math.abs(b.scrollTop - lastTop.current);
        lastTop.current = b.scrollTop;
        if (moved < b.clientHeight / 2 || b.contains(document.activeElement)) return;
        if (typeof matchMedia === 'function' && matchMedia('(forced-colors: active)').matches) return;
        setFlinging(true);
        clearTimeout(settle.current);
        settle.current = setTimeout(() => { settle.current = undefined; setFlinging(false); }, FLING_SETTLE);
      });
    });
  } : undefined;
  /* the placeholder stands for a virtual window: a table that stops being virtual (filtered to a few rows, no
     maxHeight) shows its rows */
  const fling = flinging && virtual && !loading && range.end > range.start;
  useEffect(() => () => { cancelAnimationFrame(frame.current); frame.current = 0; clearTimeout(settle.current); settle.current = undefined; }, []);

  /* ---- keyboard grid: rows −1 (header) · pinned · data; one tab stop */
  const P = pinnedRows.length, N = sorted.length;
  const [cellState, setCell] = useState<{ r: number; c: number }>({ r: -1, c: 0 });
  /* the tab stop stays on the grid when rows are filtered away or columns hidden under it */
  const cell = { r: Math.max(-1, Math.min(P + N - 1, cellState.r)), c: Math.max(0, Math.min(C - 1, cellState.c)) };
  const want = useRef<{ r: number; c: number } | null>(null);
  const cellEl = (r: number, c: number) => box.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`) ?? null;
  const target = (el: HTMLElement) => { const inner = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)); return inner.length === 1 ? inner[0] : el; };
  const focusCell = (r: number, c: number) => {
    const rr = Math.max(-1, Math.min(P + N - 1, r)), cc = Math.max(0, Math.min(C - 1, c));
    setCell({ r: rr, c: cc });
    const el = cellEl(rr, cc);
    if (el) { target(el).focus({ preventScroll: false }); el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); return; }
    /* not rendered (virtualised): scroll it into the window, focus once rendered */
    want.current = { r: rr, c: cc };
    const b = box.current;
    if (b && rr >= P) {
      const top = (head.current?.offsetHeight ?? 0) + (pin.current?.offsetHeight ?? 0);
      const y = top + (rr - P) * rowH;
      if (y < b.scrollTop + top) b.scrollTop = y - top; else b.scrollTop = y - b.clientHeight + rowH;
      measure();
    }
  };
  useIsoLayoutEffect(() => {
    if (!want.current) return;
    const el = cellEl(want.current.r, want.current.c);
    if (el) { target(el).focus({ preventScroll: true }); want.current = null; }
  });
  /* header rows stick one under another: each header cell's top is the offset of its row (measured; a sticky
     <thead> would not carry the sticky-left cells along in every engine) */
  const stickHead = () => {
    const h = head.current, b = box.current;
    if (!h) return;
    h.querySelectorAll<HTMLTableRowElement>(':scope > tr:not(.sg-table__busy)').forEach((tr) => {
      const top = `${tr.offsetTop}px`;
      tr.querySelectorAll<HTMLElement>(':scope > th, :scope > td').forEach((c) => { if (c.style.top !== top) c.style.top = top; });
    });
    /* the header's height: the busy line sits on its bottom edge, pinned rows stick under it, and focus scrolls clear of it */
    const hh = `${h.offsetHeight}px`;
    if (b && b.style.getPropertyValue('--_head-h') !== hh) b.style.setProperty('--_head-h', hh);
  };
  /* measured from a ResizeObserver — after the browser's own layout, never by forcing one while a dashboard
     mounts (the offsets only matter once the header is stuck, i.e. after scrolling) — and again whenever the
     header's size changes (web fonts arriving, wrapping titles, a resize) */
  useEffect(() => {
    const h = head.current;
    if (!h) return;
    if (typeof ResizeObserver === 'undefined') { stickHead(); return; }
    const ro = new ResizeObserver(() => stickHead());
    h.querySelectorAll(':scope > tr').forEach((tr) => ro.observe(tr));
    ro.observe(h);
    return () => ro.disconnect();
  }, [groups]);
  const focused = useRef<HTMLElement | null>(null);
  /* roving tab stop: only the current cell (or its single control) is tabbable. Two native queries per render —
     controls not yet taken out of the tab order, and the previous stop — instead of walking every cell (a 60 × 20
     comparison renders 1,200) */
  useIsoLayoutEffect(() => {
    const b = box.current;
    if (!b) return;
    b.querySelectorAll<HTMLElement>(INNER_TABBABLE).forEach((x) => { x.tabIndex = -1; });
    b.querySelectorAll<HTMLElement>('[data-r][tabindex="0"]').forEach((x) => { x.tabIndex = -1; });
    /* a virtualised stop scrolled out of the window would leave the grid with none: the nearest row in its column
       that is in sight holds it until then — not the nearest rendered one, which is an overscan row out of sight
       (behind the sticky header and pinned rows, or below the box), where focus would sit unseen and the next
       arrow key scroll the table back */
    let el = cellEl(cell.r, cell.c);
    if (!el && cell.r >= P && range.end > range.start && !fling) {
      const top = (head.current?.offsetHeight ?? 0) + (pin.current?.offsetHeight ?? 0);
      /* rows wholly in sight; when the pinned rows leave room for less than one, the row that shows more */
      const end = b.scrollTop + b.clientHeight - top;
      let first = Math.ceil(b.scrollTop / rowH), last = Math.floor(end / rowH) - 1;
      if (last < first) { const k = Math.floor(b.scrollTop / rowH); first = last = (k + 1) * rowH - b.scrollTop >= end - (k + 1) * rowH ? k : k + 1; }
      const clamp = (i: number) => P + Math.max(range.start, Math.min(range.end - 1, i));
      el = cellEl(cell.r < P + first ? clamp(first) : clamp(last), cell.c);
    }
    /* rows flying past are placeholders: the column's header holds the stop until they are rendered, so Tab still
       reaches the grid */
    if (!el && fling) el = cellEl(-1, cell.c);
    if (!el) return;
    target(el).tabIndex = 0;
    /* the focused cell was taken away (its row scrolled out of the window, or was filtered out): focus went to the
       page and the arrow keys with it, so it moves to the stop */
    const a = document.activeElement;
    if (focused.current && !focused.current.isConnected && (!a || a === document.body)) target(el).focus({ preventScroll: true });
  });
  const pageRows = Math.max(1, Math.floor(((box.current?.clientHeight ?? 400) - (head.current?.offsetHeight ?? 0)) / rowH) - 1);
  const onKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const from = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
    if (!from) return;
    const r = +from.dataset.r!, c = +from.dataset.c!;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    /* typing in a field inside a cell keeps its keys */
    if ((e.target as HTMLElement).matches('input:not([type=checkbox]), textarea, select')) return;
    let n: [number, number] | null = null;
    if (k === 'ArrowRight') n = [r, c + 1];
    else if (k === 'ArrowLeft') n = [r, c - 1];
    else if (k === 'ArrowDown') n = [r + 1, c];
    else if (k === 'ArrowUp') n = [r - 1, c];
    else if (k === 'Home') n = ctrl ? [P > 0 ? 0 : P, 0] : [r, 0];
    else if (k === 'End') n = ctrl ? [P + N - 1, C - 1] : [r, C - 1];
    else if (k === 'PageDown') n = [Math.min(P + N - 1, r + pageRows), c];
    else if (k === 'PageUp') n = [Math.max(r < P ? -1 : P, r - pageRows), c];
    else if (k === ' ' && selectable && r >= P && !(e.target as HTMLElement).matches('button, a')) { e.preventDefault(); toggleRow(r - P, e.shiftKey); return; }
    else if (k === 'Enter' && r >= P && onRowClick && (e.target as HTMLElement) === from) { e.preventDefault(); onRowClick(sorted[r - P]); return; }
    else if (ctrl && (k === 'a' || k === 'A') && selectable) { e.preventDefault(); setSel([...new Set([...sel, ...keys])]); return; }
    if (!n) return;
    e.preventDefault();
    focusCell(n[0], n[1]);
  };

  const onRowClickCapture = (row: T) => (e: MouseEvent) => {
    if (!onRowClick) return;
    if ((e.target as HTMLElement).closest('a, button, input, label, [role=button]')) return;
    onRowClick(row);
  };

  /* ---- header */
  const sortIcon = (c: Column<T>) => {
    const on = sortState?.key === c.key ? sortState.dir : null;
    /* two chevrons: unsorted shows both; a direction keeps its chevron and slides it to the middle (transform and
       opacity only — the CSS \`d\` property, which could morph the path, does not exist in WebKit) */
    return (
      <svg className="sg-table__sort" data-dir={on ?? undefined} viewBox="0 0 12 12" aria-hidden="true">
        <path className="sg-table__sort-up" d="M3.5 5L6 2.5 8.5 5" /><path className="sg-table__sort-down" d="M3.5 7L6 9.5 8.5 7" />
      </svg>
    );
  };
  const th = (c: Column<T>, ci: number, rowSpan?: number) => {
    const colIdx = ci + (selectable ? 1 : 0);
    const aria = sortState?.key === c.key ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined;
    const inner = (
      <span className="sg-table__head">
        <span className={cx('sg-table__title', !!c.description && 'sg-table__title--term')}>{c.header}</span>
        {/* when any column has a second line, the others keep an empty one, so every title sits on the same line */}
        {c.subheader ? <span className="sg-table__sub">{c.subheader}</span> : anySub && <span className="sg-table__sub" aria-hidden="true">{'\u00a0'}</span>}
      </span>
    );
    const body = c.sortable ? (
      <button type="button" className="sg-table__sortbtn" onClick={() => nextSort(c)}>{inner}{sortIcon(c)}</button>
    ) : c.description ? <span tabIndex={-1} className="sg-table__headtxt">{inner}</span> : inner;
    return (
      <th key={c.key} scope="col" rowSpan={rowSpan} aria-sort={aria} data-r={-1} data-c={colIdx} tabIndex={-1} data-align={c.align ?? 'start'}
        className={colClass(colIdx, ci)}
        style={stickyLeft[colIdx] !== undefined ? { left: stickyLeft[colIdx] } : undefined}>
        {c.description ? <Tooltip content={c.description} placement="top">{body}</Tooltip> : body}
      </th>
    );
  };
  const groupRow = () => {
    const out: ReactNode[] = [];
    if (selectable) out.push(<th key="sel" rowSpan={2} className="sg-table__sticky sg-table__check" style={{ left: 0 }} data-r={-1} data-c={0} tabIndex={-1}>{selectAllBox}</th>);
    let i = 0;
    while (i < cols.length) {
      const g = cols[i].group;
      if (!g) { out.push(th(cols[i], i, 2)); i++; continue; }
      let j = i; while (j < cols.length && cols[j].group === g) j++;
      /* a group made only of frozen columns stays with them */
      const first = i + (selectable ? 1 : 0), frozen = cols.slice(i, j).every((_, k) => stickyLeft[first + k] !== undefined);
      out.push(<th key={`g-${g}-${i}`} scope="colgroup" colSpan={j - i} className={cx('sg-table__group', frozen && 'sg-table__sticky', frozen && first + (j - i) - 1 === lastSticky && 'sg-table__sticky--last', lineAfter(j - 1) && 'sg-table__vline')} style={frozen ? { left: stickyLeft[first] } : undefined}><span>{g}</span></th>);
      i = j;
    }
    return out;
  };
  const selectAllBox = (
    <Checkbox className="sg-table__checkbox" aria-label={labels.selectAll ?? t.selectAll} checked={allOn} indeterminate={someOn} onChange={toggleAll} disabled={!N} />
  );

  /* ---- body */
  const renderCells = (row: T, ri: number, gridRow: number, pinned: boolean, isSel: boolean) => (
    <>
      {selectable && (
        <td className="sg-table__sticky sg-table__check" style={{ left: 0 }} data-r={gridRow} data-c={0} tabIndex={-1}>
          {/* rows: the library checkbox's markup, look and motion (the tick draws in), written out here instead of a
              <Checkbox> per row — no hooks per row while a virtualised table mounts rows by the dozen */}
          {!pinned && (
            <label className="sg-check sg-table__checkbox">
              <input type="checkbox" className="sg-check__input" aria-label={labels.selectRow?.(row) ?? t.selectRow} checked={isSel}
                onChange={() => {}} onClick={(e) => { e.stopPropagation(); toggleRow(ri, e.shiftKey); }} />
              <span className="sg-check__box" aria-hidden="true"><svg className="sg-check__mark" viewBox="0 0 16 16"><path className="sg-check__tick" d="M3.5 8.4l3 3 6-6.6" /></svg></span>
            </label>
          )}
        </td>
      )}
      {cols.map((c, ci) => {
        const colIdx = ci + (selectable ? 1 : 0);
        const v = c.render ? c.render(row, { index: ri, selected: isSel, pinned }) : (row as Record<string, unknown>)[c.key];
        const Tag = colIdx === (selectable ? 1 : 0) ? 'th' : 'td';
        return (
          <Tag key={c.key} {...(Tag === 'th' ? { scope: 'row' } : {})} data-r={gridRow} data-c={colIdx} tabIndex={-1} data-align={c.align ?? 'start'}
            className={colClass(colIdx, ci)}
            style={stickyLeft[colIdx] !== undefined ? { left: stickyLeft[colIdx] } : undefined}>
            {/* a missing value reads "–"; in a summary row an empty cell is "not applicable" and stays blank */}
            {isEmpty(v) ? (pinned ? null : <span className="sg-table__none" aria-label="—">–</span>) : (v as ReactNode)}
          </Tag>
        );
      })}
    </>
  );

  const minWidth = widths.reduce((a, b) => a + b, 0);
  const showSkeleton = loading && N === 0;
  const total = (rowCount ?? N) + P + (groups ? 2 : 1);
  return (
    /* tabIndex -1: Firefox makes a scrolling box a tab stop of its own; here the grid's single tab stop scrolls it */
    <div ref={box} tabIndex={-1} className={cx('sg-table', `sg-table--${density}`, loading && 'sg-table--loading', virtual && 'sg-table--virtual', maxHeight !== undefined && 'sg-table--scroll-y', className)} style={{ maxHeight, ...style, ['--_rh' as string]: `${rowH}px`, ['--_pin-h' as string]: `${P * rowH}px`, ['--_stick-w' as string]: `${stickyW}px` } as CSSProperties}
      onScroll={onScroll} onPointerDown={flinging ? endFling : undefined} aria-busy={loading || undefined}>
      <table role="grid" aria-label={label} aria-rowcount={total} aria-colcount={C} aria-multiselectable={selectable || undefined} style={{ minWidth }} onKeyDown={onKey}
        onBlur={(e) => {
          /* focus left the grid (a click elsewhere, Tab away): the grid no longer holds it, and must not take it
             back when that cell scrolls out of the window later. A cell taken out of the document loses focus
             without this mattering, so it is decided once the removal is done */
          const t = e.target as HTMLElement, to = e.relatedTarget as Node | null;
          if (to && e.currentTarget.contains(to)) return;
          want.current = null;   /* a cell asked for by a key, not yet rendered, must not pull focus back later */
          queueMicrotask(() => { if (focused.current === t && t.isConnected && document.activeElement !== t) focused.current = null; });
        }}
        onFocus={(e) => { if (flinging) endFling(); focused.current = e.target as HTMLElement; const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]'); if (el) { const r = +el.dataset.r!, c = +el.dataset.c!; if (r !== cell.r || c !== cell.c) setCell({ r, c }); } }}>
        <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead ref={head}>
          {groups ? (
            <>
              <tr aria-rowindex={1}>{groupRow()}</tr>
              <tr aria-rowindex={2}>{cols.map((c, ci) => (c.group ? th(c, ci) : null))}</tr>
            </>
          ) : (
            <tr aria-rowindex={1}>
              {selectable && <th className="sg-table__sticky sg-table__check" style={{ left: 0 }} data-r={-1} data-c={0} tabIndex={-1}>{selectAllBox}</th>}
              {cols.map((c, ci) => th(c, ci))}
            </tr>
          )}
          {loading && N > 0 && <tr className="sg-table__busy" aria-hidden="true"><td colSpan={C}><span /></td></tr>}
        </thead>
        {P > 0 && (
          <tbody ref={pin} className="sg-table__pinned">
            {pinnedRows.map((row, i) => <tr key={rowKey(row)} aria-rowindex={(groups ? 3 : 2) + i} style={{ ['--_pi' as string]: i } as CSSProperties}>{renderCells(row, i, i, true, false)}</tr>)}
          </tbody>
        )}
        <tbody>
          {showSkeleton && Array.from({ length: 6 }, (_, i) => (
            <tr key={`sk${i}`} aria-hidden="true">{Array.from({ length: C }, (_, j) => {
              /* placed like the cells they stand in for: same alignment, same frozen columns */
              const col = selectable ? (j === 0 ? null : cols[j - 1]) : cols[j];
              return (
                <td key={j} data-align={col?.align ?? (col ? 'start' : 'center')} className={cx(col ? colClass(j, j - (selectable ? 1 : 0)) : 'sg-table__sticky sg-table__check')}
                  style={stickyLeft[j] !== undefined ? { left: stickyLeft[j] } : undefined}>
                  <Skeleton width={col ? `${50 + ((i * 7 + j * 13) % 40)}%` : 22} height={col ? undefined : 22} radius={col ? undefined : 7} />
                </td>
              );
            })}</tr>
          ))}
          {!loading && N === 0 && (
            <tr><td colSpan={C} className="sg-table__empty">{empty ?? labels.empty ?? t.empty}</td></tr>
          )}
          {virtual && range.start > 0 && <tr aria-hidden="true" style={{ height: range.start * rowH }} />}
          {fling && (
            <tr aria-hidden="true" className="sg-table__fling" style={{ height: (range.end - range.start) * rowH }}>{Array.from({ length: C }, (_, j) => {
              const col = selectable ? (j === 0 ? null : cols[j - 1]) : cols[j];
              return <td key={j} data-bar={col ? (col.align ?? 'start') : undefined}
                className={col ? colClass(j, j - (selectable ? 1 : 0)) : 'sg-table__sticky sg-table__check'}
                style={stickyLeft[j] !== undefined ? { left: stickyLeft[j] } : undefined} />;
            })}</tr>
          )}
          {!fling && sorted.slice(range.start, range.end).map((row, k) => {
            const ri = range.start + k, key = keys[ri], isSel = selSet.has(key), st = rowState?.(row);
            return (
              <Fragment key={key}>
                <tr aria-rowindex={(groups ? 3 : 2) + P + ri} aria-selected={selectable ? isSel : undefined} data-muted={st?.muted || undefined}
                  className={cx(onRowClick && 'sg-table__row--action')} onClick={onRowClickCapture(row)}>
                  {renderCells(row, ri, P + ri, false, isSel)}
                </tr>
              </Fragment>
            );
          })}
          {virtual && range.end < N && <tr aria-hidden="true" style={{ height: (N - range.end) * rowH }} />}
        </tbody>
      </table>
      <span className="sg-visually-hidden" aria-live="polite">{sortState ? `${((h) => (typeof h === 'string' || typeof h === 'number' ? String(h) : sortState.key))(columns.find((c) => c.key === sortState.key)?.header)} ${sortState.dir === 'asc' ? labels.sortedAsc ?? t.sortedAsc : labels.sortedDesc ?? t.sortedDesc}` : ''}</span>
    </div>
  );
}

/* ================================================================================================ ColumnChooser (0.6)
   Which columns a DataTable shows: a button that opens a popover of checkboxes, grouped like the table's header
   (a group's own checkbox shows or hides it whole, indeterminate when partly shown). Columns that are not hideable
   — sticky ones by default, they say which row is which — are listed checked and locked, and the last shown
   column cannot be hidden. The page owns the hidden keys and gives the same list to the table. */
export type ColumnChooserProps<T> = {
  /** the same columns the table gets (their groups become the panel's sections) */
  columns: Column<T>[];
  /** keys of the hidden columns; pass the same list to the table's `hiddenColumns` */
  hidden: string[];
  /** called with the new hidden keys when a box is changed */
  onHiddenChange: (keys: string[]) => void;
  /** the button's text (default "Columns", or 열 in Korean) */
  label?: ReactNode;
  /** the button's look */
  variant?: ButtonVariant;
  /** the button's size */
  size?: 'sm' | 'md';
  /** an icon before the button's text */
  icon?: ReactNode;
  labels?: { panel?: string; showAll?: string; count?: (shown: number, total: number) => string };
  className?: string;
};

export function ColumnChooser<T>({ columns, hidden, onHiddenChange, label: labelProp, variant = 'neutral', size = 'sm', icon, labels = {}, className }: ColumnChooserProps<T>) {
  const t = useMessages().table, label = labelProp ?? t.columns;
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const can = (c: Column<T>) => c.hideable ?? !c.sticky;
  const off = new Set(hidden.filter((k) => columns.some((c) => c.key === k && can(c))));
  const shown = columns.length - off.size;
  const set = (keys: string[], show: boolean) => {
    const next = new Set(off);
    for (const k of keys) show ? next.delete(k) : next.add(k);
    /* never hide everything: keep the first of these on if nothing else would show */
    if (next.size >= columns.length) next.delete(keys[0]);
    onHiddenChange(columns.filter((c) => next.has(c.key)).map((c) => c.key));
  };
  /* sections in column order: a run of one group is one section; ungrouped columns sit in unnamed ones */
  const sections: { group?: string; cols: Column<T>[] }[] = [];
  for (const c of columns) {
    const last = sections[sections.length - 1];
    if (last && last.group === c.group) last.cols.push(c); else sections.push({ group: c.group, cols: [c] });
  }
  const text = (h: ReactNode, key: string) => (typeof h === 'string' || typeof h === 'number' ? h : key);
  const count = labels.count?.(shown, columns.length) ?? `${shown}/${columns.length}`;
  return (
    <>
      <Button ref={btn} type="button" variant={variant} size={size} startIcon={icon} className={cx('sg-colchooser__button', className)}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}{off.size > 0 && <span className="sg-colchooser__count">{count}</span>}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={btn.current} placement="bottom-end" aria-label={labels.panel ?? (typeof label === 'string' ? label : t.columns)} className="sg-colchooser">
        {sections.map((sec, i) => {
          const keys = sec.cols.filter(can).map((c) => c.key);
          const on = keys.filter((k) => !off.has(k)).length;
          return (
            <div key={i} className="sg-colchooser__section" role="group" aria-label={sec.group}>
              {sec.group && (
                <Checkbox className="sg-colchooser__group" label={sec.group} checked={keys.length > 0 && on === keys.length} indeterminate={on > 0 && on < keys.length}
                  disabled={!keys.length} onChange={(v) => set(keys, v)} />
              )}
              {sec.cols.map((c) => (
                <Checkbox key={c.key} className={cx('sg-colchooser__item', !!sec.group && 'sg-colchooser__item--nested')} label={text(c.header, c.key)}
                  checked={!off.has(c.key)} disabled={!can(c) || (!off.has(c.key) && shown === 1)} onChange={(v) => set([c.key], v)} />
              ))}
            </div>
          );
        })}
        {off.size > 0 && (
          <div className="sg-colchooser__foot">
            <Button size="sm" variant="plain" onClick={() => onHiddenChange([])}>{labels.showAll ?? t.showAll}</Button>
          </div>
        )}
      </Popover>
    </>
  );
}
