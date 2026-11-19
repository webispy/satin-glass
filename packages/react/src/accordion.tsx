/* Accordion (0.3): sections that open in place. Buttons with aria-expanded control their regions; the region
   unfolds (rows 0fr → 1fr, one element) and its content fades in; with reduced motion it simply appears. */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { cx, useControllable, useStableId } from './utils';
import { ChevronDownIcon } from './icons';

export type AccordionItem = { value: string; title: ReactNode; meta?: ReactNode; content: ReactNode; disabled?: boolean };
export type AccordionProps = {
  items: AccordionItem[];
  /** several open at once (default) or one at a time */
  multiple?: boolean;
  value?: string[]; defaultValue?: string[]; onChange?: (open: string[]) => void;
  /** heading level of the titles (default 3) */
  level?: 2 | 3 | 4 | 5 | 6;
  className?: string; style?: CSSProperties;
};

export function Accordion({ items, multiple = true, value, defaultValue = [], onChange, level = 3, className, style }: AccordionProps) {
  const [open, setOpen] = useControllable<string[]>(value, defaultValue, onChange);
  const id = useStableId('sg-acc');
  const root = useRef<HTMLDivElement>(null);
  const H = `h${level}` as 'h3';
  const toggle = (v: string) => setOpen(open.includes(v) ? open.filter((x) => x !== v) : multiple ? [...open, v] : [v]);
  return (
    <div ref={root} className={cx('sg-accordion', className)} style={style}>
      {items.map((it, i) => {
        const on = open.includes(it.value);
        return (
          <div key={it.value} className="sg-accordion__item" data-open={on || undefined}>
            <H className="sg-accordion__heading">
              <button type="button" id={`${id}-b${i}`} className="sg-accordion__trigger" aria-expanded={on} aria-controls={`${id}-r${i}`} disabled={it.disabled} onClick={() => toggle(it.value)}>
                <span className="sg-accordion__title">{it.title}</span>
                {it.meta && <span className="sg-accordion__meta">{it.meta}</span>}
                <ChevronDownIcon className="sg-accordion__chevron" />
              </button>
            </H>
            <div id={`${id}-r${i}`} role="region" aria-labelledby={`${id}-b${i}`} className="sg-accordion__region" inert={!on || undefined}>
              <div className="sg-accordion__clip"><div className="sg-accordion__content">{it.content}</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
