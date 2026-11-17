/* Select (0.2): a "select-only combobox" (WAI-ARIA APG). Focus stays on the button; the listbox is driven with
   aria-activedescendant. Opens with ↓ ↑ Enter Space or by typing; ↑↓ Home End PageUp PageDown move; Enter, Space,
   Tab or Alt+↑ choose; Esc or a click outside closes without change. The panel blooms from the button. */
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { MotionName, Placement } from '@glass-layer/core';
import { cx, mergeRefs, useControllable, useStableId } from './utils';
import { MotionScope, Portal, glassClass, useGlassLight } from './foundation';
import { useAnchored } from './overlay-hooks';
import { CheckIcon } from './icons';

export type SelectOption<T extends string = string> = {
  value: T; label: ReactNode; description?: ReactNode; icon?: ReactNode; disabled?: boolean;
  /** text used for type-to-select when the label is not a string */
  textValue?: string;
};
export type SelectGroup<T extends string = string> = { label: ReactNode; options: SelectOption<T>[] };

export type SelectProps<T extends string = string> = {
  options: (SelectOption<T> | SelectGroup<T>)[];
  value?: T | null; defaultValue?: T | null; onChange?: (value: T) => void;
  placeholder?: ReactNode;
  label?: ReactNode; helperText?: ReactNode; error?: ReactNode | boolean;
  disabled?: boolean;
  /** submits with forms */
  name?: string;
  /** 'field' (default) or 'inline' — accent text without field chrome, for a list row's trailing slot */
  variant?: 'field' | 'inline';
  placement?: Placement;
  motion?: MotionName;
  id?: string; className?: string; style?: CSSProperties; 'aria-label'?: string;
};

const ChevronsIcon = (p: { className?: string }) => (
  <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" /></svg>
);
const isGroup = <T extends string>(x: SelectOption<T> | SelectGroup<T>): x is SelectGroup<T> => 'options' in x;
const textOf = <T extends string>(o: SelectOption<T>) => (o.textValue ?? (typeof o.label === 'string' ? o.label : String(o.value))).toLocaleLowerCase();

export const Select = forwardRef(function Select<T extends string = string>(
  { options, value, defaultValue = null, onChange, placeholder = 'Select…', label, helperText, error, disabled, name, variant = 'field', placement = 'bottom-start', motion, id, className, style, 'aria-label': ariaLabel }: SelectProps<T>,
  ref: React.Ref<HTMLButtonElement>,
) {
  const [v, setV] = useControllable<T | null>(value, defaultValue, onChange as (v: T | null) => void);
  const flat = useMemo(() => options.flatMap((x) => (isGroup(x) ? x.options : [x])), [options]);
  const enabled = useMemo(() => flat.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [flat]);
  const selectedIndex = flat.findIndex((o) => o.value === v);
  const selected = selectedIndex >= 0 ? flat[selectedIndex] : null;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const trigger = useRef<HTMLButtonElement>(null);
  const auto = useStableId('gl-select');
  const fid = id ?? auto, listId = `${fid}-list`, optId = (i: number) => `${fid}-o${i}`;
  const lightRef = useGlassLight();
  const typed = useRef({ buf: '', t: 0 });

  const { panel, mounted } = useAnchored(open, trigger.current, placement, () => setOpen(false), null, { matchWidth: variant === 'field', scroll: 'follow' });

  const openAt = (i: number) => { setActive(i); setOpen(true); };
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
    const order = [...enabled.filter((i) => i > from), ...enabled.filter((i) => i <= from)];
    return order.find((i) => textOf(flat[i]).startsWith(single)) ?? -1;
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const k = e.key;
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
        e.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : k === 'ArrowUp' ? enabled[enabled.length - 1] : enabled[0]);
      } else if (k.length === 1 && /\S/.test(k) && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active); }
    else if (k === 'Tab') { choose(active); }
    else if (k.length === 1 && /\S/.test(k) && !e.metaKey && !e.ctrlKey) { const i = typeahead(k, active); if (i >= 0) setActive(i); }
  };

  /* keep the active option in view */
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optId(active))?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, mounted]);

  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const labelId = label ? `${fid}-label` : undefined;
  let n = -1;
  const renderOption = (o: SelectOption<T>) => {
    const i = ++n;
    return (
      <div key={o.value} id={optId(i)} role="option" aria-selected={o.value === v} aria-disabled={o.disabled || undefined}
        data-active={i === active ? '' : undefined} className="gl-option"
        onPointerMove={() => { if (!o.disabled && active !== i) setActive(i); }}
        onMouseDown={(e) => e.preventDefault() /* focus stays on the button */}
        onClick={() => choose(i)}>
        {o.icon}
        <span className="gl-option__text"><span className="gl-option__label">{o.label}</span>{o.description && <span className="gl-option__desc">{o.description}</span>}</span>
        <CheckIcon className="gl-option__check" />
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
      aria-describedby={help ? `${fid}-help` : undefined}
      disabled={disabled}
      data-gl-motion={motion}
      className={cx('gl-select', variant === 'inline' && 'gl-select--inline', variant === 'field' ? className : undefined)}
      style={variant === 'field' ? style : undefined}
      onClick={() => (open ? setOpen(false) : openAt(selectedIndex >= 0 ? selectedIndex : enabled[0]))}
      onKeyDown={onKey}
    >
      <span className="gl-select__value">
        {selected?.icon}
        {selected ? <span>{selected.label}</span> : <span className="gl-select__placeholder">{placeholder}</span>}
      </span>
      <ChevronsIcon className="gl-select__chevrons" />
    </button>
  );

  return (
    <>
      {variant === 'inline' && !label && !help ? button : (
        <div className={cx('gl-field', variant === 'inline' ? className : undefined)} style={variant === 'inline' ? style : undefined} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
          {label && <span id={labelId} className="gl-field__label">{label}</span>}
          {button}
          {help && <span id={`${fid}-help`} className="gl-field__help">{help}</span>}
        </div>
      )}
      {name && <input type="hidden" name={name} value={v ?? ''} />}
      {mounted && (
        <MotionScope motion={motion} bare><Portal className="gl-portal--passthrough">
          <div ref={mergeRefs(panel, lightRef)} id={listId} role="listbox" aria-labelledby={labelId} aria-label={labelId ? undefined : ariaLabel} tabIndex={-1}
            className={cx('gl-listbox', glassClass('strong'))}>
            <div data-gl-content>
              {options.map((x, gi) => (isGroup(x) ? (
                <div key={`g${gi}`} role="group" aria-labelledby={`${fid}-g${gi}`}>
                  <div id={`${fid}-g${gi}`} className="gl-listbox__group" role="presentation">{x.label}</div>
                  {x.options.map(renderOption)}
                </div>
              ) : renderOption(x)))}
            </div>
          </div>
        </Portal></MotionScope>
      )}
    </>
  );
}) as <T extends string = string>(p: SelectProps<T> & { ref?: React.Ref<HTMLButtonElement> }) => React.ReactElement | null;
