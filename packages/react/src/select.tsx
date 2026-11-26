/* Select (0.2): a "select-only combobox" (WAI-ARIA APG). Focus stays on the button; the listbox is driven with
   aria-activedescendant. Opens with ↓ ↑ Enter Space or by typing; ↑↓ Home End PageUp PageDown move; Enter, Space,
   Tab or Alt+↑ choose; Esc or a click outside closes without change. The panel blooms from the button. */
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { Placement } from '@satin-glass/core';
import { cx, mergeRefs, useControllable, useStableId } from './utils';
import { Portal, useGlassLight } from './foundation';
import { glassClass } from './glass-class';
import { useAnchored } from './overlay-hooks';
import { CheckIcon, ChevronDownIcon } from './icons';
import { useMessages } from './messages';

export type SelectOption<T extends string = string> = {
  /** the value this option stands for: what `value` and `onChange` carry when it is chosen */
  value: T;
  /** the option's text, also shown in the field once chosen */
  label: ReactNode;
  /** a second, smaller line under the label, in the list only */
  description?: ReactNode;
  /** an icon before the label, in the list and in the field once chosen */
  icon?: ReactNode;
  disabled?: boolean;
  /** text used for type-to-select when the label is not a string */
  textValue?: string;
};
export type SelectGroup<T extends string = string> = { label: ReactNode; options: SelectOption<T>[] };

export type SelectProps<T extends string = string> = {
  /** the choices, in order, and named groups of them ({ label, options }) */
  options: (SelectOption<T> | SelectGroup<T>)[];
  value?: T | null; defaultValue?: T | null; onChange?: (value: T) => void;
  /** shown while nothing is chosen (default "Select…") */
  placeholder?: ReactNode;
  /** the visible label (above the field; inside the pill for 'filter'); it names the select */
  label?: ReactNode;
  /** a hint under the field, read with it as its description; an `error` message takes its place. Not shown by 'filter' */
  helperText?: ReactNode;
  /** marks the select invalid (aria-invalid); a message (anything but `true`) is shown under it in place of
      `helperText`, except by 'filter', which has no room for one */
  error?: ReactNode | boolean;
  disabled?: boolean;
  /** submits with forms */
  name?: string;
  /** 'field' (default); 'inline' — accent text without field chrome, for a list row's trailing slot;
      'filter' — a compact pill that reads "label value ▾" (toolbars and filter bars) */
  variant?: 'field' | 'inline' | 'filter';
  placement?: Placement;
  id?: string; className?: string; style?: CSSProperties; 'aria-label'?: string;
};

const ChevronsIcon = (p: { className?: string }) => (
  <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" /></svg>
);
const isGroup = <T extends string>(x: SelectOption<T> | SelectGroup<T>): x is SelectGroup<T> => 'options' in x;
const textOf = <T extends string>(o: SelectOption<T>) => (o.textValue ?? (typeof o.label === 'string' ? o.label : String(o.value))).toLocaleLowerCase();

export const Select = forwardRef(function Select<T extends string = string>(
  { options, value, defaultValue = null, onChange, placeholder: placeholderProp, label, helperText, error, disabled, name, variant = 'field', placement = 'bottom-start', id, className, style, 'aria-label': ariaLabel }: SelectProps<T>,
  ref: React.Ref<HTMLButtonElement>,
) {
  const [v, setV] = useControllable<T | null>(value, defaultValue, onChange as (v: T | null) => void);
  const words = useMessages(), placeholder = placeholderProp ?? words.selectPlaceholder;
  const flat = useMemo(() => options.flatMap((x) => (isGroup(x) ? x.options : [x])), [options]);
  const enabled = useMemo(() => flat.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [flat]);
  const selectedIndex = flat.findIndex((o) => o.value === v);
  const selected = selectedIndex >= 0 ? flat[selectedIndex] : null;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('sg-select');
  const fid = id ?? auto, listId = `${fid}-list`, optId = (i: number) => `${fid}-o${i}`;
  const lightRef = useGlassLight();
  /* hit: whether the search so far found an option */
  const typed = useRef({ buf: '', t: 0, hit: false });

  const { panel, mounted } = useAnchored(open, trigger.current, placement, () => setOpen(false), null, { matchWidth: variant === 'field' });

  const openAt = (i: number) => { setActive(i); setOpen(true); };
  /* a search lasts one opening: closing ends it, and opening by key or click starts none (only typing does) */
  const fresh = () => { typed.current.buf = ''; };
  useEffect(() => { if (!open) fresh(); }, [open]);
  const choose = (i: number) => {
    const o = flat[i];
    if (!o || o.disabled) return;
    setV(o.value); setOpen(false);
    /* Safari does not focus a button on click: make sure the select has focus after a choice, so the keyboard
       can carry on from it */
    trigger.current?.focus({ preventScroll: true });
  };
  const move = (from: number, dir: 1 | -1, steps = 1) => {
    if (!enabled.length) return -1;
    let pos = enabled.indexOf(from);
    if (pos < 0) return dir > 0 ? enabled[0] : enabled[enabled.length - 1];
    pos = Math.max(0, Math.min(enabled.length - 1, pos + dir * steps));
    return enabled[pos];
  };
  const typeahead = (ch: string, from: number) => {
    const now = performance.now();
    typed.current.buf = now - typed.current.t > 600 ? ch : typed.current.buf + ch;
    typed.current.t = now;
    const q = typed.current.buf.toLocaleLowerCase();
    /* a repeated single letter cycles through the matches */
    const single = q.length > 1 && q.split('').every((c) => c === q[0]) ? q[0] : q;
    /* a longer search may still match the active option ("new" → "new y" stays on New York); one letter moves on */
    const at = single.length > 1 ? from - 1 : from;
    const order = [...enabled.filter((i) => i > at), ...enabled.filter((i) => i <= at)];
    const i = order.find((i) => textOf(flat[i]).startsWith(single)) ?? -1;
    typed.current.hit = i >= 0;
    return i;
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const k = e.key;
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
        e.preventDefault(); fresh();
        openAt(selectedIndex >= 0 ? selectedIndex : k === 'ArrowUp' ? enabled[enabled.length - 1] : enabled[0]);
      } else if (k.length === 1 && /\S/.test(k) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        /* closed, a search that found nothing is not kept: "z" then "n" looks for "n" */
        if (!typed.current.hit) fresh();
        const i = typeahead(k, selectedIndex);
        if (i >= 0) openAt(i);
      }
      return;
    }
    if (k === 'ArrowDown') { e.preventDefault(); setActive((a) => move(a, 1)); }
    else if (k === 'ArrowUp' && e.altKey) { e.preventDefault(); choose(active); }
    else if (k === 'ArrowUp') { e.preventDefault(); setActive((a) => move(a, -1)); }
    else if (k === 'Home') { e.preventDefault(); setActive(enabled[0]); }
    else if (k === 'End') { e.preventDefault(); setActive(enabled[enabled.length - 1]); }
    else if (k === 'PageDown') { e.preventDefault(); setActive((a) => move(a, 1, 10)); }
    else if (k === 'PageUp') { e.preventDefault(); setActive((a) => move(a, -1, 10)); }
    /* while a type-ahead search is going on, Space is part of it (WAI-ARIA APG: "new y") */
    else if (k === ' ' && typed.current.buf && performance.now() - typed.current.t <= 600) { e.preventDefault(); const i = typeahead(k, active); if (i >= 0) setActive(i); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active); }
    /* focus leaves either way: the list closes even when there is nothing to take (no options, a disabled one) */
    else if (k === 'Tab') { choose(active); setOpen(false); }
    else if (k.length === 1 && /\S/.test(k) && !e.metaKey && !e.ctrlKey) { const i = typeahead(k, active); if (i >= 0) setActive(i); }
  };

  /* keep the active option in view */
  useEffect(() => {
    if (!open || active < 0) return;
    /* scroll the list only, never its ancestors: scrollIntoView would also scroll the panel (glass clips with
       overflow: hidden, which makes it a scroll container) while the bloom's 4 px content offset overhangs it — the
       rim and the items then stepped back down as the offset settled. Layout offsets, not rects: the panel is still
       scaled while it blooms. */
    const o = document.getElementById(optId(active)), list = o?.closest<HTMLElement>('[data-sg-content]');
    if (!o || !list) return;
    const m = parseFloat(getComputedStyle(o).scrollMarginTop) || 0;
    const top = o.offsetTop, bottom = top + o.offsetHeight;
    if (top - m < list.scrollTop) list.scrollTop = top - m;
    else if (bottom + m > list.scrollTop + list.clientHeight) list.scrollTop = bottom + m - list.clientHeight;
  }, [open, active, mounted]);

  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  /* the filter pill has no room under it: it shows neither, so nothing may point at them */
  const helpId = help && variant !== 'filter' ? `${fid}-help` : undefined;
  const labelId = label ? `${fid}-label` : undefined;
  let n = -1;
  const renderOption = (o: SelectOption<T>) => {
    const i = ++n;
    return (
      <div key={o.value} id={optId(i)} role="option" aria-selected={o.value === v} aria-disabled={o.disabled || undefined}
        data-active={i === active ? '' : undefined} className="sg-option"
        onPointerMove={() => { if (!o.disabled && active !== i) setActive(i); }}
        onMouseDown={(e) => e.preventDefault() /* focus stays on the button */}
        onClick={() => choose(i)}>
        {o.icon}
        <span className="sg-option__text"><span className="sg-option__label">{o.label}</span>{o.description && <span className="sg-option__desc">{o.description}</span>}</span>
        <CheckIcon className="sg-option__check" />
      </div>
    );
  };

  const button = (
    <button
      ref={mergeRefs(ref, trigger)}
      id={fid}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
      aria-labelledby={labelId ? `${labelId} ${fid}` : undefined}
      aria-label={labelId ? undefined : ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={helpId}
      disabled={disabled}
      className={cx('sg-select', variant === 'inline' && 'sg-select--inline', variant === 'filter' && 'sg-select--filter', variant !== 'inline' ? className : undefined)}
      style={variant !== 'inline' ? style : undefined}
      onClick={() => (open ? setOpen(false) : (fresh(), openAt(selectedIndex >= 0 ? selectedIndex : enabled[0])))}
      onKeyDown={onKey}
    >
      {variant === 'filter' && label && <span id={labelId} className="sg-select__prefix">{label}</span>}
      <span className="sg-select__value">
        {selected?.icon}
        {selected ? <span>{selected.label}</span> : <span className="sg-select__placeholder">{placeholder}</span>}
      </span>
      {variant === 'filter' ? <ChevronDownIcon className="sg-select__chevrons" /> : <ChevronsIcon className="sg-select__chevrons" />}
    </button>
  );

  return (
    <>
      {variant === 'filter' || (variant === 'inline' && !label && !help) ? button : (
        <div className={cx('sg-field', variant === 'inline' ? className : undefined)} style={variant === 'inline' ? style : undefined} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
          {label && <span id={labelId} className="sg-field__label">{label}</span>}
          {button}
          {helpId && <span id={helpId} className="sg-field__help">{help}</span>}
        </div>
      )}
      {/* a disabled select submits nothing, as a disabled native control */}
      {name && <input type="hidden" name={name} value={v ?? ''} disabled={disabled} />}
      {mounted && (
        <Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={mergeRefs(panel, lightRef)} id={listId} role="listbox" aria-labelledby={labelId} aria-label={labelId ? undefined : ariaLabel} tabIndex={-1}
            className={cx('sg-listbox', glassClass('strong'))}>
            <div data-sg-content>
              {options.map((x, gi) => (isGroup(x) ? (
                <div key={`g${gi}`} role="group" aria-labelledby={`${fid}-g${gi}`}>
                  <div id={`${fid}-g${gi}`} className="sg-listbox__group" role="presentation">{x.label}</div>
                  {x.options.map(renderOption)}
                </div>
              ) : renderOption(x)))}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}) as <T extends string = string>(p: SelectProps<T> & { ref?: React.Ref<HTMLButtonElement> }) => React.ReactElement | null;
