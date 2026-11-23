/* Combobox (0.5): a text field with a list of suggestions that narrows as you type — a city, a product, a person.
   One value; WAI-ARIA editable combobox with list autocomplete. Focus stays in the input; the list is driven with
   aria-activedescendant. Typing filters and makes the first match active; ↓ ↑ open and move, PageUp / PageDown move
   ten; Enter or a click takes the active suggestion; Escape closes and puts back the text of the value already
   chosen; leaving the field (Tab, a click elsewhere) does the same, and leaving it empty clears the value. Keys are
   left alone while an IME is composing (Korean, Japanese…). Loading and "no results" are said in a status line
   outside the list. The panel is Select's: it blooms from the field and rows look and press the same; filtering
   changes the rows in place.
   multiple (0.6): several values, shown as small removable chips in the field before the text. Choosing toggles an
   option and keeps the list open (the text clears so the whole list comes back); Backspace in an empty field
   removes the last chip; the listbox is multi-selectable and the chips are named in the field's description. */
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { Placement } from '@satin-glass/core';
import { cx, mergeRefs, useControllable, useStableId } from './utils';
import { Portal, glassClass, useGlassLight } from './foundation';
import { useAnchored } from './overlay-hooks';
import { CheckIcon, ChevronDownIcon, ClearIcon, CloseIcon } from './icons';
import type { SelectGroup, SelectOption } from './select';
import { useMessages } from './messages';

export type ComboboxInputReason = 'input' | 'select' | 'clear' | 'restore';
type ComboboxCommon<T extends string> = {
  /** options and named groups, as Select; a rich (non-string) label needs textValue to be typed and matched */
  options: (SelectOption<T> | SelectGroup<T>)[];
  /** the text in the field (control it to search a server) */
  inputValue?: string;
  /** the starting text when uncontrolled (default: the chosen value's text) */
  defaultInputValue?: string;
  /** called with the new text and why it changed: typed ('input'), a choice ('select'), the clear button ('clear'),
      or put back to the value's text ('restore') */
  onInputChange?: (text: string, reason: ComboboxInputReason) => void;
  /** which options match the text (default: the text appears in the option's text, ignoring case); 'none' when the
      options already come filtered (a server search) */
  filter?: 'none' | ((option: SelectOption<T>, text: string) => boolean);
  /** the text of a chosen value that is not among the options (results that no longer include it) */
  getOptionText?: (value: T) => string;
  /** results are on their way: the list says so (labels.loading) in place of "No results" */
  loading?: boolean;
  /** a button that clears the value (default true) */
  clearable?: boolean;
  /** the visible label above the field, tied to the input */
  label?: ReactNode; placeholder?: string; helperText?: ReactNode; error?: ReactNode | boolean;
  disabled?: boolean;
  /** submits the value with forms */
  name?: string;
  placement?: Placement;
  labels?: { empty?: string; loading?: string; clear?: string; toggle?: string; remove?: (text: string) => string; chosen?: (texts: string[]) => string; count?: (n: number) => string };
  id?: string; className?: string; style?: CSSProperties; 'aria-label'?: string;
};
export type ComboboxProps<T extends string = string> = ComboboxCommon<T> & (
  | {
      /** several values, shown as removable chips; `value`, `defaultValue` and `onChange` then take an array, and
          choosing toggles an option and keeps the list open */
      multiple?: false; value?: T | null; defaultValue?: T | null; onChange?: (value: T | null) => void }
  | {
      /** several values, shown as removable chips; `value`, `defaultValue` and `onChange` then take an array, and
          choosing toggles an option and keeps the list open */
      multiple: true; value?: T[]; defaultValue?: T[]; onChange?: (values: T[]) => void;
      /** when more than this many are chosen, a count ("3 selected") stands in for the chips, so the field keeps one
          line (a filter bar); a partial row of chips would hide most of the choice anyway */
      maxChips?: number }
);

const isGroup = <T extends string>(x: SelectOption<T> | SelectGroup<T>): x is SelectGroup<T> => 'options' in x;
const textOf = <T extends string>(o: SelectOption<T>) => o.textValue ?? (typeof o.label === 'string' ? o.label : String(o.value));
const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase();
const contains = <T extends string>(o: SelectOption<T>, q: string) => norm(textOf(o)).includes(norm(q));

/* the part of a string label that matches the text, emphasised */
function Marked({ text, q }: { text: string; q: string }) {
  const i = q ? norm(text).indexOf(norm(q)) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="sg-option__match">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

const Values = ({ multi, children }: { multi: boolean; children: ReactNode }) => (multi ? <span className="sg-combobox__values">{children}</span> : <>{children}</>);

export const Combobox = forwardRef(function Combobox<T extends string = string>(
  { options, multiple, value, defaultValue, onChange, inputValue, defaultInputValue, onInputChange, filter, getOptionText, loading, clearable = true,
    label, placeholder, helperText, error, disabled, name, placement = 'bottom-start', labels, id, className, style, 'aria-label': ariaLabel, ...rest }: ComboboxProps<T>,
  ref: React.Ref<HTMLInputElement>,
) {
  const m = useMessages();
  const multi = multiple === true;
  const maxChips = (rest as { maxChips?: number }).maxChips ?? Infinity;
  const [raw, setRaw] = useControllable<T | null | T[]>(value, defaultValue ?? (multi ? [] : null), onChange as (v: T | null | T[]) => void);
  /* one value (single) or none; the chosen list (multiple) */
  const v = multi ? null : (raw as T | null);
  const list: T[] = multi ? ((raw as T[] | null) ?? []) : [];
  const setV = (x: T | null) => setRaw(x);
  /* the text of every value seen, so a chosen one keeps its name when a search no longer returns it */
  const known = useRef(new Map<string, string>());
  for (const x of options) for (const o of isGroup(x) ? x.options : [x]) known.current.set(o.value, textOf(o));
  const textFor = (val: T | null) => (val == null ? '' : known.current.get(val) ?? getOptionText?.(val) ?? String(val));

  const [ownText, setOwnText] = useState(() => defaultInputValue ?? (multi ? '' : textFor(v)));
  const text = inputValue ?? ownText;
  const setText = (t: string, reason: ComboboxInputReason) => { if (inputValue === undefined) setOwnText(t); onInputChange?.(t, reason); };
  /* editing: the text was typed since the last choice; only then does it narrow the list */
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /* a value set from outside shows its text (unless someone is typing) */
  const lastV = useRef(v);
  useEffect(() => { if (!multi && lastV.current !== v) { lastV.current = v; if (!editing) setText(textFor(v), 'restore'); } });

  /* multiple: the text is only a search, so it always narrows */
  const q = editing || multi ? text.trim() : '';
  const matches = (o: SelectOption<T>) => !q || filter === 'none' || (filter ? filter(o, q) : contains(o, q));
  const shown = useMemo(() => options.map((x) => (isGroup(x) ? { ...x, options: x.options.filter(matches) } : x))
    .filter((x) => (isGroup(x) ? x.options.length > 0 : matches(x))), [options, q, filter]);
  const flat = useMemo(() => shown.flatMap((x) => (isGroup(x) ? x.options : [x])), [shown]);
  const enabled = useMemo(() => flat.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [flat]);
  const selectedIndex = multi ? -1 : flat.findIndex((o) => o.value === v);
  const isOn = (val: T) => (multi ? list.includes(val) : val === v);
  /* multiple: after a choice clears the text the list grows back; keep the chosen option active */
  const keep = useRef<T | null>(null);
  useEffect(() => { if (keep.current !== null) { const i = flat.findIndex((o) => o.value === keep.current); keep.current = null; if (i >= 0) setActive(i); } }, [flat]);

  const input = useRef<HTMLInputElement>(null), control = useRef<HTMLDivElement>(null);
  const auto = useStableId('sg-combo');
  const fid = id ?? auto, listId = `${fid}-list`, optId = (i: number) => `${fid}-o${i}`;
  const lightRef = useGlassLight();

  /* the text typed: the first match becomes active */
  useEffect(() => { if (open && editing) setActive(enabled[0] ?? -1); }, [q, open, editing, flat.length]);

  const restore = () => { setText(multi ? '' : textFor(v), 'restore'); setEditing(false); setOpen(false); };
  const { panel, mounted } = useAnchored(open, control.current, placement, (r) => { if (r === 'escape') restore(); else if (open) leave(); }, null, { matchWidth: true });

  const choose = (i: number) => {
    const o = flat[i];
    if (!o || o.disabled) return;
    if (multi) {
      setRaw(list.includes(o.value) ? list.filter((x) => x !== o.value) : [...list, o.value]);
      if (text) { setText('', 'select'); keep.current = o.value; }
      setEditing(false); setActive(i);
      input.current?.focus({ preventScroll: true });
      return;
    }
    setV(o.value); setText(textOf(o), 'select'); setEditing(false); setOpen(false);
    input.current?.focus({ preventScroll: true });
  };
  const remove = (val: T) => { setRaw(list.filter((x) => x !== val)); input.current?.focus({ preventScroll: true }); };
  const clear = () => { setRaw(multi ? [] : null); setText('', 'clear'); setEditing(false); setOpen(false); input.current?.focus({ preventScroll: true }); };
  /* leaving the field: an emptied field clears the value, any other unfinished text goes back to the value's */
  const leave = () => {
    if (multi) { if (text) setText('', 'restore'); setEditing(false); setOpen(false); return; }
    if (editing && !text.trim() && v != null) { setV(null); setText('', 'clear'); setEditing(false); setOpen(false); return; }
    if (editing || text !== textFor(v)) restore(); else setOpen(false);
  };
  const openAt = (i: number) => { setActive(i); setOpen(true); };
  const move = (from: number, dir: 1 | -1, steps = 1) => {
    if (!enabled.length) return -1;
    let pos = enabled.indexOf(from);
    if (pos < 0) return dir > 0 ? enabled[0] : enabled[enabled.length - 1];
    pos = Math.max(0, Math.min(enabled.length - 1, pos + dir * steps));
    return enabled[pos];
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || e.nativeEvent.isComposing || e.keyCode === 229) return;   /* an IME is composing: its keys */
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      if (!open) openAt(selectedIndex >= 0 ? selectedIndex : k === 'ArrowUp' ? enabled[enabled.length - 1] ?? -1 : enabled[0] ?? -1);
      else if (e.altKey && k === 'ArrowUp') { if (active >= 0) choose(active); else restore(); }
      else setActive((a) => move(a, k === 'ArrowDown' ? 1 : -1));
    } else if (open && (k === 'PageDown' || k === 'PageUp')) { e.preventDefault(); setActive((a) => move(a, k === 'PageDown' ? 1 : -1, 10)); }
    else if (k === 'Enter' && open) { e.preventDefault(); if (active >= 0) choose(active); }
    else if (k === 'Escape' && !open && editing) { e.preventDefault(); restore(); }
    else if (k === 'Backspace' && multi && !text && list.length) { e.preventDefault(); remove(list[list.length - 1]); }
  };

  /* keep the active option in view (the list scrolls, never the panel: see Select) */
  useEffect(() => {
    if (!open || active < 0) return;
    const o = document.getElementById(optId(active)), list = o?.closest<HTMLElement>('[data-sg-content]');
    if (!o || !list) return;
    const m = parseFloat(getComputedStyle(o).scrollMarginTop) || 0;
    const top = o.offsetTop, bottom = top + o.offsetHeight;
    if (top - m < list.scrollTop) list.scrollTop = top - m;
    else if (bottom + m > list.scrollTop + list.clientHeight) list.scrollTop = bottom + m - list.clientHeight;
  }, [open, active, mounted]);

  const invalid = Boolean(error);
  const help = typeof error === 'string' || (error && typeof error !== 'boolean') ? error : helperText;
  const labelId = label ? `${fid}-label` : undefined;
  const status = loading ? labels?.loading ?? m.combobox.loading : !flat.length ? labels?.empty ?? m.combobox.empty : null;
  let n = -1;
  const renderOption = (o: SelectOption<T>) => {
    const i = ++n;
    return (
      <div key={o.value} id={optId(i)} role="option" aria-selected={isOn(o.value)} aria-disabled={o.disabled || undefined}
        data-active={i === active ? '' : undefined} className="sg-option"
        onPointerMove={() => { if (!o.disabled && active !== i) setActive(i); }}
        onMouseDown={(e) => e.preventDefault() /* focus stays in the input */}
        onClick={() => choose(i)}>
        {o.icon}
        <span className="sg-option__text">
          <span className="sg-option__label">{typeof o.label === 'string' ? <Marked text={o.label} q={q} /> : o.label}</span>
          {o.description && <span className="sg-option__desc">{o.description}</span>}
        </span>
        <CheckIcon className="sg-option__check" />
      </div>
    );
  };

  return (
    <>
      <div className={cx('sg-field sg-combobox', multi && 'sg-combobox--multi', className)} style={style} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
        {label && <label id={labelId} className="sg-field__label" htmlFor={fid}>{label}</label>}
        <div ref={control} className="sg-field__control">
          {/* multiple: the chips and the text wrap together; clear and toggle stay on the first line's end */}
          <Values multi={multi}>
          {multi && list.length <= maxChips && list.map((val) => {
            const t = textFor(val);
            return (
              <span key={val} className="sg-combobox__chip">
                <span className="sg-combobox__chip-text">{t}</span>
                {!disabled && (
                  <button type="button" tabIndex={-1} className="sg-combobox__chip-remove" aria-label={labels?.remove?.(t) ?? m.remove(t)}
                    onMouseDown={(e) => e.preventDefault()} onClick={() => remove(val)}><CloseIcon /></button>
                )}
              </span>
            );
          })}
          {multi && list.length > maxChips && <span className="sg-combobox__count" aria-hidden="true">{labels?.count?.(list.length) ?? m.combobox.count(list.length)}</span>}
          <input ref={mergeRefs(ref, input)} id={fid} className="sg-field__input" type="text" role="combobox" autoComplete="off" spellCheck={false}
            aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
            aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
            aria-label={labelId ? undefined : ariaLabel} aria-invalid={invalid || undefined} aria-describedby={cx(!!help && `${fid}-help`, multi && list.length > 0 && `${fid}-chosen`) || undefined}
            disabled={disabled} placeholder={multi && list.length ? undefined : placeholder} value={text}
            onChange={(e) => { setText(e.currentTarget.value, 'input'); setEditing(true); setOpen(true); }}
            onClick={() => { if (!open) openAt(selectedIndex >= 0 ? selectedIndex : enabled[0] ?? -1); }}
            onKeyDown={onKey}
            onBlur={() => leave()} />
          </Values>
          {clearable && !disabled && (v != null || list.length > 0 || text) && (
            <button type="button" className="sg-field__clear" tabIndex={-1} aria-label={labels?.clear ?? m.clear} onMouseDown={(e) => e.preventDefault()} onClick={clear}><ClearIcon /></button>
          )}
          <button type="button" className="sg-combobox__toggle" tabIndex={-1} disabled={disabled} aria-label={labels?.toggle ?? m.combobox.toggle} aria-expanded={open} aria-controls={open ? listId : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { if (open) restore(); else { openAt(selectedIndex >= 0 ? selectedIndex : enabled[0] ?? -1); input.current?.focus({ preventScroll: true }); } }}>
            <ChevronDownIcon />
          </button>
        </div>
        {help && <span id={`${fid}-help`} className="sg-field__help">{help}</span>}
        {multi && list.length > 0 && <span id={`${fid}-chosen`} hidden>{labels?.chosen?.(list.map(textFor)) ?? list.map(textFor).join(', ')}</span>}
      </div>
      {name && (multi ? list.map((x) => <input key={x} type="hidden" name={name} value={x} disabled={disabled} />) : <input type="hidden" name={name} value={v ?? ''} disabled={disabled} />)}
      {mounted && (
        <Portal className="sg-portal--passthrough sg-portal--anchored">
          <div ref={mergeRefs(panel, lightRef)} className={cx('sg-listbox sg-combobox__panel', glassClass('strong'))}>
            <div data-sg-content>
              <div id={listId} role="listbox" aria-multiselectable={multi || undefined} aria-labelledby={labelId} aria-label={labelId ? undefined : ariaLabel}>
                {shown.map((x, gi) => (isGroup(x) ? (
                  <div key={`g${gi}`} role="group" aria-labelledby={`${fid}-g${gi}`}>
                    <div id={`${fid}-g${gi}`} className="sg-listbox__group" role="presentation">{x.label}</div>
                    {x.options.map(renderOption)}
                  </div>
                ) : renderOption(x)))}
              </div>
              <div role="status" className="sg-combobox__status" data-hidden={status ? undefined : ''}>{status}</div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}) as <T extends string = string>(p: ComboboxProps<T> & { ref?: React.Ref<HTMLInputElement> }) => React.ReactElement | null;
