/* Pagination (0.3): pages with first / last always in reach and the neighbourhood of the current one; gaps
   fold into "…". Narrow containers switch to "3 / 20" between the arrows (a container query, no measuring). */
import type { CSSProperties } from 'react';
import { cx } from './utils';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export type PaginationProps = {
  /** 1-based */
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** pages shown on each side of the current one */
  siblings?: number;
  'aria-label'?: string;
  labels?: { previous?: string; next?: string; page?: (n: number) => string };
  className?: string; style?: CSSProperties;
};

/** The page numbers to show: 1 … 4 5 [6] 7 8 … 20 (gaps as null). Always the same count while the current page
    moves through the middle, so the buttons do not jump around under the pointer. */
export function pageWindow(page: number, count: number, siblings = 1): (number | null)[] {
  const slots = siblings * 2 + 5;   /* first, last, current, siblings, two gaps */
  if (count <= slots) return Array.from({ length: count }, (_, i) => i + 1);
  const left = Math.max(page - siblings, 3), right = Math.min(page + siblings, count - 2);
  if (page - siblings <= 3) return [...Array.from({ length: slots - 2 }, (_, i) => i + 1), null, count];
  if (page + siblings >= count - 2) return [1, null, ...Array.from({ length: slots - 2 }, (_, i) => count - (slots - 3) + i)];
  return [1, null, ...Array.from({ length: right - left + 1 }, (_, i) => left + i), null, count];
}

export function Pagination({ page, pageCount, onChange, siblings = 1, 'aria-label': label = 'Pagination', labels = {}, className, style }: PaginationProps) {
  const count = Math.max(1, pageCount), cur = Math.min(Math.max(1, page), count);
  const pageLabel = labels.page ?? ((n: number) => `Page ${n}`);
  const go = (n: number) => { if (n >= 1 && n <= count && n !== cur) onChange(n); };
  return (
    /* --_digits: every slot as wide as the widest page number, so nothing shifts while the window moves */
    <nav aria-label={label} className={cx('gl-pagination', className)} data-wide={siblings > 1 || undefined} style={{ ['--_digits' as string]: String(count).length, ...style } as CSSProperties}>
      <button type="button" className="gl-pagination__step" aria-label={labels.previous ?? 'Previous page'} disabled={cur <= 1} onClick={() => go(cur - 1)}><ChevronLeftIcon /></button>
      <ol className="gl-pagination__pages">
        {pageWindow(cur, count, siblings).map((n, i) => (
          <li key={n ?? `gap${i}`}>
            {n === null ? <span className="gl-pagination__gap" aria-hidden="true">…</span> : (
              <button type="button" className="gl-pagination__page" aria-label={pageLabel(n)} aria-current={n === cur ? 'page' : undefined} onClick={() => go(n)}>{n}</button>
            )}
          </li>
        ))}
      </ol>
      <span className="gl-pagination__compact" aria-hidden="true">{cur} / {count}</span>
      <button type="button" className="gl-pagination__step" aria-label={labels.next ?? 'Next page'} disabled={cur >= count} onClick={() => go(cur + 1)}><ChevronRightIcon /></button>
    </nav>
  );
}
