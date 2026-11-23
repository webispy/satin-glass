/* Accordion (0.3; its motion settled in 0.5): sections that open in place. Buttons with aria-expanded control their
   regions. One press, one movement, the menus' bloom applied to a section: the region opens on the personality's
   smooth spring while its content comes out from behind the heading on the pop spring — from a little above and a
   little small (by the personality's squash), settling with the pop's overshoot (calm: none) — and the chevron turns
   with the region. Closing folds the content back behind the heading as the region shuts; it lands as soon as it
   reaches none. A press mid-way turns back from where it is, keeping its speed. Reduced motion: the height changes at
   once and the content fades in. */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { loop, motionFor, prefersReducedMotion, Spring } from '@satin-glass/core';
import { cx, useControllable, useIsoLayoutEffect, useStableId } from './utils';
import { ChevronDownIcon } from './icons';

export type AccordionItem = { value: string; title: ReactNode; meta?: ReactNode; content: ReactNode; disabled?: boolean };
export type AccordionProps = {
  /** the sections, top to bottom; each `value` is the key that `value` / `onChange` list when it is open, and `meta`
      is quiet text at the end of the heading */
  items: AccordionItem[];
  /** several open at once (default) or one at a time */
  multiple?: boolean;
  value?: string[]; defaultValue?: string[]; onChange?: (open: string[]) => void;
  /** heading level of the titles (default 3) */
  level?: 2 | 3 | 4 | 5 | 6;
  className?: string; style?: CSSProperties;
};

type Run = { s: Spring; P: Spring; stop: (() => void) | null; open: boolean };

export function Accordion({ items, multiple = true, value, defaultValue = [], onChange, level = 3, className, style }: AccordionProps) {
  const [open, setOpen] = useControllable<string[]>(value, defaultValue, onChange);
  const id = useStableId('sg-acc');
  const root = useRef<HTMLDivElement>(null);
  const runs = useRef(new Map<string, Run>());
  const H = `h${level}` as 'h3';
  const toggle = (v: string) => setOpen(open.includes(v) ? open.filter((x) => x !== v) : multiple ? [...open, v] : [v]);

  /* a section that opened or closed: its height runs on the spring from where it is now */
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    for (const item of Array.from(el.querySelectorAll<HTMLElement>(':scope > .sg-accordion__item'))) {
      const key = item.dataset.value!, on = item.hasAttribute('data-open');
      const run = runs.current.get(key);
      if (!run) { runs.current.set(key, { s: new Spring(0, 'smooth', item), P: new Spring(on ? 1 : 0, 'pop', item), stop: null, open: on }); continue; }
      if (run.open === on) continue;
      run.open = on;
      const region = item.querySelector<HTMLElement>('.sg-accordion__region')!, chev = item.querySelector<HTMLElement>('.sg-accordion__chevron');
      const con = item.querySelector<HTMLElement>('.sg-accordion__content');
      const full = (con?.offsetHeight ?? 0) || 1;
      /* where the content blooms from: a little small, more so the livelier the personality */
      const sq = motionFor(item).squash;
      const sx0 = 0.98 - sq * 0.15, sy0 = 0.92 - sq * 0.75;
      if (prefersReducedMotion(item)) { run.stop?.(); run.stop = null; region.style.height = ''; if (chev) chev.style.transform = ''; continue; }
      /* where it starts: mid-way, wherever the spring is; at rest, the height it had (the stylesheet already shows the
         new state, so the DOM cannot say) */
      if (!run.stop) { run.s.set('smooth', item); run.s.jump(on ? 0 : full); run.P.set('pop', item); run.P.jump(on ? 0 : 1); }
      run.s.target = on ? full : 0;
      run.P.target = on ? 1 : 0;
      const paint = () => {
        const h = Math.max(0, run.s.value);
        region.style.height = `${h.toFixed(2)}px`;
        if (chev) chev.style.transform = `rotate(${((run.s.value / full) * 180).toFixed(2)}deg)`;
        if (!con) return;
        /* the content comes out from behind the heading (the region clips it there) */
        const q = 1 - run.P.value;
        con.style.transformOrigin = '50% 0';
        con.style.transform = `translateY(${(-28 * q).toFixed(2)}px) scale(${(1 - q * (1 - sx0)).toFixed(4)}, ${(1 - q * (1 - sy0)).toFixed(4)})`;
      };
      paint();
      run.stop ??= loop((dt) => {
        run.s.step(dt); run.P.step(dt);
        /* closing ends at the end it reaches: a height cannot go below none, so it lands at once instead of ringing
           there (and the chevron with it) */
        const shut = run.s.target === 0 && run.s.value <= 0.5;
        if (shut) run.s.jump(0);
        paint();
        if (!shut && !(run.s.settled && run.P.settled)) return;
        run.s.jump(run.s.target); run.P.jump(run.P.target);
        /* at rest the stylesheet holds it: auto height when open (content may change), none when closed */
        region.style.height = ''; if (chev) chev.style.transform = ''; if (con) { con.style.transform = ''; con.style.transformOrigin = ''; }
        run.stop = null;
        return false;
      });
    }
  });
  useIsoLayoutEffect(() => () => { for (const r of runs.current.values()) r.stop?.(); }, []);

  return (
    <div ref={root} className={cx('sg-accordion', className)} style={style}>
      {items.map((it, i) => {
        const on = open.includes(it.value);
        return (
          <div key={it.value} className="sg-accordion__item" data-value={it.value} data-open={on || undefined}>
            <H className="sg-accordion__heading">
              <button type="button" id={`${id}-b${i}`} className="sg-accordion__trigger" aria-expanded={on} aria-controls={`${id}-r${i}`} disabled={it.disabled} onClick={() => toggle(it.value)}>
                <span className="sg-accordion__title">{it.title}</span>
                {it.meta && <span className="sg-accordion__meta">{it.meta}</span>}
                <ChevronDownIcon className="sg-accordion__chevron" />
              </button>
            </H>
            <div id={`${id}-r${i}`} role="region" aria-labelledby={`${id}-b${i}`} className="sg-accordion__region" inert={!on || undefined}>
              <div className="sg-accordion__content">{it.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
