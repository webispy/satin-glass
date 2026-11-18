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
import { cx, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { Tooltip } from './feedback';
import { Skeleton } from './skeleton';
import { Checkbox } from './selection';

export type SortDir = 'asc' | 'desc';
export type SortState = { key: string; dir: SortDir } | null;

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** second header line: units, sample size… */
  subheader?: ReactNode;
  /** what the column means (shown on hover / focus of the header) */
  description?: ReactNode;
  /** consecutive columns with the same group share a header above them */
  group?: string;
  width?: number;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
  /** first direction when sorting by this column (numbers where higher is better: 'desc') */
  firstSort?: SortDir;
  /** value to sort by (default: row[key]) */
  value?: (row: T) => unknown;
  render?: (row: T, ctx: { index: number; selected: boolean; pinned: boolean }) => ReactNode;
  /** stays in view when the table scrolls sideways (leading columns only) */
  sticky?: boolean;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  'aria-label': string;
  sort?: SortState; defaultSort?: SortState; onSortChange?: (s: SortState) => void;
  /** rows are already sorted (by a server): only report sort changes */
  manualSort?: boolean;
  selectable?: boolean;
  selected?: string[]; defaultSelected?: string[]; onSelectedChange?: (keys: string[]) => void;
  /** summary rows above the data; not sorted, not selectable */
  pinnedRows?: T[];
  density?: 'compact' | 'regular';
  /** the table scrolls inside this height (sticky header; virtualised beyond ~80 rows) */
  maxHeight?: number | string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** total rows on the server (for screen readers when paging) */
  rowCount?: number;
  /** extra props per row: muted (e.g. too few samples) */
  rowState?: (row: T) => { muted?: boolean } | undefined;
  labels?: { selectAll?: string; selectRow?: (row: T) => string; empty?: string; sortedAsc?: string; sortedDesc?: string };
  className?: string; style?: CSSProperties;
};

const ROW_H = { compact: 36, regular: 44 };
const SEL_W = 44, DEFAULT_W = 120, OVERSCAN = 8, VIRTUAL_FROM = 80;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]';

function compareValues(a: unknown, b: unknown): number {
  const ea = a === null || a === undefined || a === '' || (typeof a === 'number' && isNaN(a));
  const eb = b === null || b === undefined || b === '' || (typeof b === 'number' && isNaN(b));
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;   /* handled again below so empties stay last in both directions */
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v));

export function DataTable<T>({
  rows, columns, rowKey, 'aria-label': label, sort, defaultSort = null, onSortChange, manualSort, selectable,
  selected, defaultSelected = [], onSelectedChange, pinnedRows = [], density = 'regular', maxHeight, loading, empty,
  onRowClick, rowCount, rowState, labels = {}, className, style,
}: DataTableProps<T>) {
  const [sortState, setSort] = useControllable<SortState>(sort, defaultSort, onSortChange);
  const [sel, setSel] = useControllable<string[]>(selected, defaultSelected, onSelectedChange);
  const selSet = useMemo(() => new Set(sel), [sel]);
  const box = useRef<HTMLDivElement>(null), head = useRef<HTMLTableSectionElement>(null), pin = useRef<HTMLTableSectionElement>(null);
  const id = useStableId('gl-table');
  const rowH = ROW_H[density];

  /* ---- sorting (stable; empty values last whichever the direction) */
  const sorted = useMemo(() => {
    if (manualSort || !sortState) return rows;
    const col = columns.find((c) => c.key === sortState.key);
    if (!col) return rows;
    const get = col.value ?? ((r: T) => (r as Record<string, unknown>)[col.key]);
    const sign = sortState.dir === 'asc' ? 1 : -1;
    return rows.map((r, i) => ({ r, i, v: get(r) })).sort((a, b) => {
      const ea = isEmpty(a.v), eb = isEmpty(b.v);
      if (ea || eb) return ea === eb ? a.i - b.i : ea ? 1 : -1;
      return sign * compareValues(a.v, b.v) || a.i - b.i;
    }).map((x) => x.r);
  }, [rows, columns, sortState, manualSort]);
  const nextSort = (c: Column<T>) => {
    const first = c.firstSort ?? 'asc', other = first === 'asc' ? 'desc' : 'asc';
    if (!sortState || sortState.key !== c.key) return setSort({ key: c.key, dir: first });
    if (sortState.dir === first) return setSort({ key: c.key, dir: other });
    setSort(null);
  };

  /* ---- selection */
  const anchor = useRef<number | null>(null);
  const keys = useMemo(() => sorted.map(rowKey), [sorted, rowKey]);
  const allOn = keys.length > 0 && keys.every((k) => selSet.has(k));
  const someOn = !allOn && keys.some((k) => selSet.has(k));
  const toggleRow = (i: number, range: boolean) => {
    const k = keys[i];
    if (range && anchor.current !== null) {
      const [a, b] = [Math.min(anchor.current, i), Math.max(anchor.current, i)];
      const on = !selSet.has(k) || selSet.has(keys[anchor.current]);
      const next = new Set(sel);
      for (let j = a; j <= b; j++) on ? next.add(keys[j]) : next.delete(keys[j]);
      setSel([...next]);
    } else setSel(selSet.has(k) ? sel.filter((x) => x !== k) : [...sel, k]);
    anchor.current = i;
  };
  const toggleAll = () => setSel(allOn ? sel.filter((k) => !keys.includes(k)) : [...new Set([...sel, ...keys])]);

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
  useEffect(() => {
    if (!virtual || typeof ResizeObserver === 'undefined' || !box.current) return;
    const ro = new ResizeObserver(measure); ro.observe(box.current);
    return () => ro.disconnect();
  }, [virtual]);
  const range = virtual ? win : { start: 0, end: sorted.length };

  /* ---- keyboard grid: rows −1 (header) · pinned · data; one tab stop */
  const P = pinnedRows.length, N = sorted.length;
  const [cell, setCell] = useState<{ r: number; c: number }>({ r: -1, c: 0 });
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
    h.querySelectorAll<HTMLTableRowElement>(':scope > tr:not(.gl-table__busy)').forEach((tr) => {
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
  /* roving tab stop: only the current cell (or its single control) is tabbable */
  useIsoLayoutEffect(() => {
    const b = box.current;
    if (!b) return;
    b.querySelectorAll<HTMLElement>('[data-r]').forEach((el) => {
      const on = +el.dataset.r! === cell.r && +el.dataset.c! === cell.c;
      const inner = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      inner.forEach((x) => { x.tabIndex = -1; });
      el.tabIndex = -1;
      if (on) (inner.length === 1 ? inner[0] : el).tabIndex = 0;
    });
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
      <svg className="gl-table__sort" data-dir={on ?? undefined} viewBox="0 0 12 12" aria-hidden="true">
        <path className="gl-table__sort-up" d="M3.5 5L6 2.5 8.5 5" /><path className="gl-table__sort-down" d="M3.5 7L6 9.5 8.5 7" />
      </svg>
    );
  };
  const th = (c: Column<T>, ci: number, rowSpan?: number) => {
    const colIdx = ci + (selectable ? 1 : 0);
    const aria = sortState?.key === c.key ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined;
    const inner = (
      <span className="gl-table__head">
        <span className={cx('gl-table__title', !!c.description && 'gl-table__title--term')}>{c.header}</span>
        {/* when any column has a second line, the others keep an empty one, so every title sits on the same line */}
        {c.subheader ? <span className="gl-table__sub">{c.subheader}</span> : anySub && <span className="gl-table__sub" aria-hidden="true">{'\u00a0'}</span>}
      </span>
    );
    const body = c.sortable ? (
      <button type="button" className="gl-table__sortbtn" onClick={() => nextSort(c)}>{inner}{sortIcon(c)}</button>
    ) : c.description ? <span tabIndex={-1} className="gl-table__headtxt">{inner}</span> : inner;
    return (
      <th key={c.key} scope="col" rowSpan={rowSpan} aria-sort={aria} data-r={-1} data-c={colIdx} tabIndex={-1} data-align={c.align ?? 'start'}
        className={cx(stickyLeft[colIdx] !== undefined && 'gl-table__sticky', colIdx === lastSticky && 'gl-table__sticky--last')}
        style={stickyLeft[colIdx] !== undefined ? { left: stickyLeft[colIdx] } : undefined}>
        {c.description ? <Tooltip content={c.description} placement="top">{body}</Tooltip> : body}
      </th>
    );
  };
  const groupRow = () => {
    const out: ReactNode[] = [];
    if (selectable) out.push(<th key="sel" rowSpan={2} className="gl-table__sticky gl-table__check" style={{ left: 0 }} data-r={-1} data-c={0} tabIndex={-1}>{selectAllBox}</th>);
    let i = 0;
    while (i < cols.length) {
      const g = cols[i].group;
      if (!g) { out.push(th(cols[i], i, 2)); i++; continue; }
      let j = i; while (j < cols.length && cols[j].group === g) j++;
      /* a group made only of frozen columns stays with them */
      const first = i + (selectable ? 1 : 0), frozen = cols.slice(i, j).every((_, k) => stickyLeft[first + k] !== undefined);
      out.push(<th key={`g-${g}-${i}`} scope="colgroup" colSpan={j - i} className={cx('gl-table__group', frozen && 'gl-table__sticky', frozen && first + (j - i) - 1 === lastSticky && 'gl-table__sticky--last')} style={frozen ? { left: stickyLeft[first] } : undefined}><span>{g}</span></th>);
      i = j;
    }
    return out;
  };
  const selectAllBox = (
    <Checkbox className="gl-table__checkbox" aria-label={labels.selectAll ?? 'Select all rows'} checked={allOn} indeterminate={someOn} onChange={toggleAll} disabled={!N} />
  );

  /* ---- body */
  const renderCells = (row: T, ri: number, gridRow: number, pinned: boolean, isSel: boolean) => (
    <>
      {selectable && (
        <td className="gl-table__sticky gl-table__check" style={{ left: 0 }} data-r={gridRow} data-c={0} tabIndex={-1}>
          {/* rows: the library checkbox's markup, look and motion (the tick draws in), written out here instead of a
              <Checkbox> per row — no hooks per row while a virtualised table mounts rows by the dozen */}
          {!pinned && (
            <label className="gl-check gl-table__checkbox">
              <input type="checkbox" className="gl-check__input" aria-label={labels.selectRow?.(row) ?? 'Select row'} checked={isSel}
                onChange={() => {}} onClick={(e) => { e.stopPropagation(); toggleRow(ri, e.shiftKey); }} />
              <span className="gl-check__box" aria-hidden="true"><svg className="gl-check__mark" viewBox="0 0 16 16"><path className="gl-check__tick" d="M3.5 8.4l3 3 6-6.6" /></svg></span>
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
            className={cx(stickyLeft[colIdx] !== undefined && 'gl-table__sticky', colIdx === lastSticky && 'gl-table__sticky--last')}
            style={stickyLeft[colIdx] !== undefined ? { left: stickyLeft[colIdx] } : undefined}>
            {/* a missing value reads "–"; in a summary row an empty cell is "not applicable" and stays blank */}
            {isEmpty(v) ? (pinned ? null : <span className="gl-table__none" aria-label="—">–</span>) : (v as ReactNode)}
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
    <div ref={box} tabIndex={-1} className={cx('gl-table', `gl-table--${density}`, loading && 'gl-table--loading', virtual && 'gl-table--virtual', className)} style={{ maxHeight, ...style, ['--_rh' as string]: `${rowH}px`, ['--_pin-h' as string]: `${P * rowH}px`, ['--_stick-w' as string]: `${stickyW}px` } as CSSProperties}
      onScroll={virtual ? measure : undefined} aria-busy={loading || undefined}>
      <table role="grid" aria-label={label} aria-rowcount={total} aria-colcount={C} aria-multiselectable={selectable || undefined} style={{ minWidth }} onKeyDown={onKey}
        onFocus={(e) => { const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]'); if (el) { const r = +el.dataset.r!, c = +el.dataset.c!; if (r !== cell.r || c !== cell.c) setCell({ r, c }); } }}>
        <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead ref={head}>
          {groups ? (
            <>
              <tr aria-rowindex={1}>{groupRow()}</tr>
              <tr aria-rowindex={2}>{cols.map((c, ci) => (c.group ? th(c, ci) : null))}</tr>
            </>
          ) : (
            <tr aria-rowindex={1}>
              {selectable && <th className="gl-table__sticky gl-table__check" style={{ left: 0 }} data-r={-1} data-c={0} tabIndex={-1}>{selectAllBox}</th>}
              {cols.map((c, ci) => th(c, ci))}
            </tr>
          )}
          {loading && N > 0 && <tr className="gl-table__busy" aria-hidden="true"><td colSpan={C}><span /></td></tr>}
        </thead>
        {P > 0 && (
          <tbody ref={pin} className="gl-table__pinned">
            {pinnedRows.map((row, i) => <tr key={rowKey(row)} aria-rowindex={(groups ? 3 : 2) + i} style={{ ['--_pi' as string]: i } as CSSProperties}>{renderCells(row, i, i, true, false)}</tr>)}
          </tbody>
        )}
        <tbody>
          {showSkeleton && Array.from({ length: 6 }, (_, i) => (
            <tr key={`sk${i}`} aria-hidden="true">{Array.from({ length: C }, (_, j) => {
              /* placed like the cells they stand in for: same alignment, same frozen columns */
              const col = selectable ? (j === 0 ? null : cols[j - 1]) : cols[j];
              return (
                <td key={j} data-align={col?.align ?? (col ? 'start' : 'center')} className={cx(stickyLeft[j] !== undefined && 'gl-table__sticky', j === lastSticky && 'gl-table__sticky--last', !col && 'gl-table__check')}
                  style={stickyLeft[j] !== undefined ? { left: stickyLeft[j] } : undefined}>
                  <Skeleton width={col ? `${50 + ((i * 7 + j * 13) % 40)}%` : 22} height={col ? undefined : 22} radius={col ? undefined : 7} />
                </td>
              );
            })}</tr>
          ))}
          {!loading && N === 0 && (
            <tr><td colSpan={C} className="gl-table__empty">{empty ?? labels.empty ?? 'No data'}</td></tr>
          )}
          {virtual && range.start > 0 && <tr aria-hidden="true" style={{ height: range.start * rowH }} />}
          {sorted.slice(range.start, range.end).map((row, k) => {
            const ri = range.start + k, key = keys[ri], isSel = selSet.has(key), st = rowState?.(row);
            return (
              <Fragment key={key}>
                <tr aria-rowindex={(groups ? 3 : 2) + P + ri} aria-selected={selectable ? isSel : undefined} data-muted={st?.muted || undefined}
                  className={cx(onRowClick && 'gl-table__row--action')} onClick={onRowClickCapture(row)}>
                  {renderCells(row, ri, P + ri, false, isSel)}
                </tr>
              </Fragment>
            );
          })}
          {virtual && range.end < N && <tr aria-hidden="true" style={{ height: (N - range.end) * rowH }} />}
        </tbody>
      </table>
      <span className="gl-visually-hidden" aria-live="polite">{sortState ? `${((h) => (typeof h === 'string' || typeof h === 'number' ? String(h) : sortState.key))(columns.find((c) => c.key === sortState.key)?.header)} ${sortState.dir === 'asc' ? labels.sortedAsc ?? 'sorted ascending' : labels.sortedDesc ?? 'sorted descending'}` : ''}</span>
    </div>
  );
}
