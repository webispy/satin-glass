/* Button, TextField, CheckBox, Slider, ChoicePicker and DateTimeInput of the A2UI basic catalog, drawn with Satin
   controls. Values are two-way bound through the binder's setters. A field's check messages show once the user has
   left it; a button its checks disable says why at once. */
import { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Checkbox, Chip, ChoiceList, DatePicker, SegmentedControl, Radio, RadioGroup, SearchField, Slider, Stack, Text, TextField, TimePicker, VisuallyHidden } from '@satin-glass/react';
import { fieldBox, grow, ids, InButtonContext, FieldScopeContext, pathsIn, resolvePaths, revealFields, useAgentName, useEnv, useFieldErrors, useSlot, type Rendered } from './shared';
import { checkText } from '../words';
import { markTrustedGesture } from '../urls';
import { MAX_TEXT, safePattern } from '../patterns';

/* ---- Button: primary → filled, default → tinted, borderless → plain */
const BUTTON = { primary: 'filled', default: 'tinted', borderless: 'plain' } as const;
export function A2uiButton(r: Rendered<{ child?: string; variant?: keyof typeof BUTTON; action?: () => Promise<void> }>) {
  const { props, buildChild } = r;
  const env = useEnv(), why = useId();
  const { ref, aria, described, describe } = useAgentName<HTMLButtonElement>(r);
  const blocked = props.isValid === false;
  const reason = blocked ? ([...new Set((props.validationErrors ?? []).filter(Boolean).map((m) => checkText(String(m), env.words)))].join(' ') || env.words.fix) : undefined;
  /* a button is as wide as its label (the catalog's own renderer does the same), placed by its Column's alignment
     (at the start when the Column stretches); weighted in a Row, it takes its share. It is made prominent by its
     variant's fill, not by its width (design language §8) */
  const slot = useSlot(r);
  const share = slot.inRow && !!props.weight;
  /* blocked by its checks, it is unavailable (aria-disabled: dimmed, still reached with Tab) and says why to a screen
     reader from the start. A press sends nothing: it shows why below it, shows the errors of the fields its checks
     read and moves the focus to the first of them still wrong (or keeps it). Once its checks pass, the reason goes;
     failing again, it starts quiet */
  const scope = useContext(FieldScopeContext);
  const [tried, setTried] = useState(false), [attempt, setAttempt] = useState(0), [toFix, setToFix] = useState(0);
  const targets = useRef<HTMLElement[]>([]), self = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (!blocked) setTried(false); }, [blocked]);
  /* the focus goes to the first field still wrong that takes it (a disabled one does not), or stays on the button */
  useEffect(() => {
    if (!attempt) return;
    const list = targets.current;
    targets.current = [];
    for (const t of list) { t.focus(); if (document.activeElement === t) return; }
    self.current?.focus();
  }, [attempt]);   // eslint-disable-line react-hooks/exhaustive-deps
  const refuse = () => {
    const raw = r.context.componentModel.properties;
    const hits = revealFields(scope, resolvePaths(r, pathsIn(raw['@checks'] ?? raw.checks)));
    targets.current = hits.map((h) => (h.matches(FOCUSABLE) ? h : h.querySelector<HTMLElement>(FOCUSABLE))).filter((x): x is HTMLElement => !!x);
    setToFix(hits.length);
    setTried(true);
    setAttempt((n) => n + 1);
  };
  /* each refused press is said, as a new node so that it is said again: the reason, which was already the button's
     description, and how many fields need attention (the focus may move to one of them, or not move at all) */
  const said = reason && attempt ? [reason, toFix ? env.words.fieldsToFix(toFix) : ''].filter(Boolean).join(' ') : '';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: share ? 'stretch' : 'flex-start', gap: 4, maxWidth: '100%', ...(share ? grow(props.weight) : { width: 'fit-content' }) }}>
      <Button ref={(el: HTMLButtonElement | null) => { self.current = el; ref(el); }} variant={BUTTON[props.variant ?? 'default'] ?? 'tinted'} aria-disabled={blocked || undefined} aria-describedby={ids(described, reason ? why : undefined)} {...aria}
        onClick={(e) => {
          if (blocked) { e.preventDefault(); e.stopPropagation(); refuse(); return; }
          if (e.nativeEvent.isTrusted) markTrustedGesture();
          void props.action?.();
        }}>
        <InButtonContext.Provider value={true}>{props.child ? buildChild(props.child) : null}</InButtonContext.Provider>
      </Button>
      {reason && (tried ? <Text id={why} variant="footnote" tone="secondary">{reason}</Text> : <VisuallyHidden id={why}>{reason}</VisuallyHidden>)}
      {blocked && <VisuallyHidden aria-live="polite">{said && <span key={attempt}>{said}</span>}</VisuallyHidden>}
      {describe}
    </span>
  );
}
const FOCUSABLE = 'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"])';

/* ---- TextField: shortText, longText (multi-line), number and obscured. v0.9.1's `validationRegexp` is checked here,
   as the catalog asks of the renderer: only a pattern whose work is bounded (patterns.ts), on text of a bounded
   length (longer text fails the check), so an agent's pattern cannot stall the page. */
export function A2uiTextField(r: Rendered<{ label?: unknown; value?: unknown; setValue?: (v: string) => void; placeholder?: unknown; variant?: string; validationRegexp?: string }>) {
  const { props } = r;
  const env = useEnv();
  const label = props.label == null ? undefined : String(props.label);
  const { ref, aria, described, describe } = useAgentName<HTMLInputElement & HTMLTextAreaElement>(r, label ?? '');
  const value = props.value == null ? '' : String(props.value);
  const source = props.validationRegexp;
  const safe = useMemo(() => (source ? safePattern(source) : undefined), [source]);
  const told = useRef('');
  useEffect(() => {
    if (safe !== null || !source || told.current === source) return;
    told.current = source;
    env.warn({ code: 'refused-pattern', componentId: r.context.componentModel.id, message: `A validationRegexp was not used: its work is not bounded (${source.slice(0, 80)}).` });
  });
  const mismatch = safe && value && (value.length > MAX_TEXT || !safe.test(value)) ? [env.words.format] : [];
  const fe = useFieldErrors(r, mismatch);
  /* Satin's field writes its error with the id `<id>-help`; the agent's description is added to it, not put over it */
  const fieldId = useId();
  const common = {
    id: fieldId, label, value, error: fe.error, placeholder: props.placeholder == null ? undefined : String(props.placeholder), ...aria,
    onFocus: fe.onFocus, onBlur: fe.onBlur, 'aria-describedby': ids(described, fe.error ? `${fieldId}-help` : undefined),
  };
  /* the field's weight and width go on one box around it and its description (Satin's TextField puts `style` on the
     input itself, inside the field's own box) */
  const box = fieldBox(r, useSlot(r));
  return (
    <div ref={fe.host} style={{ display: 'flex', flexDirection: 'column', ...box }}>
      {props.variant === 'longText'
        ? <TextField {...common} multiline ref={ref} onChange={(e) => props.setValue?.(e.target.value)} />
        : <TextField {...common} ref={ref} type={props.variant === 'obscured' ? 'password' : 'text'}
          inputMode={props.variant === 'number' ? 'decimal' : undefined} onChange={(e) => props.setValue?.(e.target.value)} />}
      {describe}
    </div>
  );
}

export function A2uiCheckBox(r: Rendered<{ label?: unknown; value?: unknown; setValue?: (v: boolean) => void }>) {
  const { props } = r;
  const label = props.label == null ? '' : String(props.label);
  const { ref, aria, described, describe } = useAgentName<HTMLInputElement>(r, label);
  const fe = useFieldErrors(r);
  return (
    <Stack ref={fe.host} gap={1} style={grow(props.weight)} onFocus={fe.onFocus} onBlur={fe.onBlur}>
      <Checkbox ref={ref} label={label} checked={!!props.value} onChange={(v) => props.setValue?.(v)} {...aria}
        aria-invalid={fe.invalid} aria-describedby={ids(described, fe.describedBy)} />
      {fe.message}{describe}
    </Stack>
  );
}

/* ---- Slider: the track moves in whole positions (v1.0 `steps` divisions of the range, otherwise 100), each mapped to
   a model value; so a range of any size, however small, moves, and the value written is exact at each position.
   v1.0's 4 steps over 0–100 move in 25s. A range of no width is shown disabled. */
const shown = (v: number) => String(Number(v.toPrecision(10)));
export function A2uiSlider(r: Rendered<{ label?: unknown; min?: number; max?: number; value?: unknown; setValue?: (v: number) => void; steps?: number }>) {
  const { props } = r;
  const id = useId(), min = props.min ?? 0, max = props.max ?? 100;
  const label = props.label == null ? '' : String(props.label);
  const { ref, aria, described, describe } = useAgentName<HTMLDivElement>(r, label);
  const fe = useFieldErrors(r);
  const n = props.steps && props.steps > 0 ? Math.round(props.steps) : 100;
  const width = max - min;
  const toValue = (p: number) => (p >= n ? max : min + (width * p) / n);
  const value = Number(props.value ?? min);
  const pos = width > 0 ? Math.round(((Math.min(max, Math.max(min, value)) - min) / width) * n) : 0;
  const slot = useSlot(r);
  return (
    <Stack ref={fe.host} gap={1} style={fieldBox(r, slot)} onFocus={fe.onFocus} onBlur={fe.onBlur}>
      {label && <Text id={id} variant="subhead">{label}</Text>}
      <Slider ref={ref} aria-labelledby={label && !aria['aria-label'] ? id : undefined} {...aria} min={0} max={n} step={1} disabled={!(width > 0)}
        aria-invalid={fe.invalid} aria-describedby={ids(described, fe.describedBy)}
        value={pos} format={(p) => shown(toValue(p))} onChange={(p) => props.setValue?.(toValue(p))} />
      {fe.message}{describe}
    </Stack>
  );
}

/* ---- ChoicePicker: the value is a list of strings in both modes ([value] when only one may be chosen).
   checkbox style → radio buttons (one) or a choice list (many); chips → chips, with the radio pattern when only one
   may be chosen (one tab stop, arrow keys choose). `filterable` adds a field that filters by label, case-insensitive;
   a chosen option the filter hides stays chosen. */
type Option = { label?: unknown; value: string };
/** whether a segment rail fits: measured (without layout it is 0), no wider than the room, and no name cut short */
export function fitsRail({ rail, available, cut }: { rail: number; available: number; cut: boolean }): boolean {
  return rail > 0 && available > 0 && !cut && rail <= available;
}
export function A2uiChoicePicker(r: Rendered<{ label?: unknown; variant?: string; options?: Option[]; value?: unknown; setValue?: (v: string[]) => void; displayStyle?: string; filterable?: boolean }>) {
  const { props } = r;
  const env = useEnv(), labelId = useId();
  const label = props.label == null ? '' : String(props.label);
  const { aria, described, describe } = useAgentName<HTMLElement>(r, label);
  const fe = useFieldErrors(r);
  const one = props.variant !== 'multipleSelection';
  const chosen = Array.isArray(props.value) ? props.value.map(String) : props.value == null || props.value === '' ? [] : [String(props.value)];
  const [query, setQuery] = useState('');
  const all = (props.options ?? []).map((o) => ({ value: String(o.value), label: o.label == null ? String(o.value) : String(o.label) }));
  const q = props.filterable ? query.trim().toLocaleLowerCase() : '';
  const shown = q ? all.filter((o) => o.label.toLocaleLowerCase().includes(q)) : all;
  const visible = new Set(shown.map((o) => o.value));
  const hidden = chosen.filter((c) => !visible.has(c));
  /* the value this picker wrote itself, until the binder hands it back */
  const mine = useRef<string | null>(null);
  const set = (v: string[]) => { mine.current = JSON.stringify(v); props.setValue?.(v); };
  /* a short choice of one (2–4 options, no filter) is drawn as Satin's segmented control when its rail fits the
     room and the agent's value is one of the options (a segment rail always shows one chosen). Decided when the agent
     sends the options or a value, and when the room changes; never by the user's own pick, so the controls do not
     change under the hand. Measured with a hidden rail in the real styles; unmeasured (the server, no layout), chips. */
  const candidate = one && props.displayStyle === 'chips' && !props.filterable && all.length >= 2 && all.length <= 4;
  const host = useRef<HTMLDivElement>(null), probe = useRef<HTMLDivElement>(null), refocus = useRef(false), agentMatch = useRef(false);
  const [segment, setSegment] = useState(false);
  const valKey = JSON.stringify(chosen), optKey = JSON.stringify(all);
  /* the room the rail has: in a Column the picker takes the Column's width, and weighted in a Row it has its own
     share (which it does not share again with its siblings), so its own box; elsewhere its nearest box */
  const slot = useSlot(r);
  const room = () => { if (slot.inColumn || props.weight) return host.current; let b = host.current?.parentElement ?? null; while (b && getComputedStyle(b).display === 'contents') b = b.parentElement; return b; };
  const decide = () => {
    const p = probe.current;
    const cut = !!p && [...p.querySelectorAll<HTMLElement>('.sg-segmented__label')].some((e) => e.scrollWidth > e.clientWidth + 1);
    const next = candidate && agentMatch.current && !!p && fitsRail({ rail: p.offsetWidth, available: room()?.clientWidth ?? 0, cut });
    setSegment((was) => { if (was !== next && host.current?.contains(document.activeElement)) refocus.current = true; return next; });
  };
  /* the agent's match is read again when the value is not the one this picker wrote, and whenever the options change
     (a press on the chosen option writes the same value, so nothing comes back to clear `mine`) */
  const seenOpt = useRef(optKey);
  useLayoutEffect(() => {
    if (mine.current !== valKey || seenOpt.current !== optKey) agentMatch.current = all.some((o) => o.value === chosen[0]);
    seenOpt.current = optKey;
    mine.current = null;
    decide();
  }, [valKey, optKey, candidate]);   // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const b = room();
    if (!candidate || !b || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => decide());
    ro.observe(b);
    return () => ro.disconnect();
  }, [candidate]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* switched while the focus was in it: the focus goes to the chosen one in the new controls */
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (host.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? host.current?.querySelector<HTMLElement>('[role="radio"]'))?.focus();
  }, [segment]);
  const filter = props.filterable && (
    <SearchField label={env.words.filter} value={query} onChange={(e) => setQuery(e.target.value)} clearable onClear={() => setQuery('')} />
  );
  const empty = shown.length === 0 && <Text variant="footnote" tone="secondary">{env.words.noMatches}</Text>;
  const named = { 'aria-labelledby': label && !aria['aria-label'] ? labelId : undefined, ...aria, 'aria-invalid': fe.invalid, 'aria-describedby': ids(described, fe.describedBy) };
  let body;
  if (segment) {
    body = <SegmentedControl {...named} options={all.map((o) => ({ value: o.value, label: o.label }))} value={chosen[0]} onChange={(x) => set([x])} />;
  } else if (props.displayStyle === 'chips') {
    body = one ? <RadioChips options={shown} value={chosen[0]} onChange={(v) => set([v])} {...named} /> : (
      <div role="group" {...named} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {shown.map((o) => <Chip key={o.value} selected={chosen.includes(o.value)} onSelectedChange={(on) => set(on ? [...chosen, o.value] : chosen.filter((v) => v !== o.value))}>{o.label}</Chip>)}
      </div>
    );
  } else if (one) {
    body = (
      <RadioGroup value={chosen[0] ?? ''} onChange={(v) => set([v])} aria-label={aria['aria-label'] ?? (label || undefined)}>
        {shown.map((o) => <Radio key={o.value} value={o.value} label={o.label} />)}
      </RadioGroup>
    );
  } else {
    /* the list sees only what it shows; the choices the filter hides are added back once */
    body = <ChoiceList multiple aria-label={aria['aria-label'] ?? label} options={shown.map((o) => ({ value: o.value, label: o.label }))}
      value={chosen.filter((c) => visible.has(c))} onChange={(v: string[]) => set([...hidden, ...v])} />;
  }
  /* radio buttons and the choice list name themselves; the error and the description reach them through a group
     around them, which takes no name of its own (one name, announced once) */
  if (props.displayStyle !== 'chips' && !segment) body = <div role="group" aria-invalid={fe.invalid} aria-describedby={ids(described, fe.describedBy)}>{body}</div>;
  return (
    <Stack ref={(el: HTMLDivElement | null) => { host.current = el; fe.host(el); }} gap={2} style={{ position: 'relative', ...fieldBox(r, slot) }} onFocus={fe.onFocus} onBlur={fe.onBlur}>
      {label && <Text id={labelId} variant="subhead">{label}</Text>}
      {filter}{shown.length ? body : empty}
      {candidate && (
        /* the rail is drawn at its own width inside an empty box, so a rail wider than the picker adds nothing to the
           scrolling area around it */
        <div data-a2ui-probe="" aria-hidden="true" inert
          style={{ position: 'absolute', insetInlineStart: 0, top: 0, width: 0, height: 0, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' }}>
          <div ref={probe} className="sg-segmented" style={{ width: 'max-content' }}>
            {all.map((o) => <span key={o.value} className="sg-segmented__item"><span className="sg-segmented__label" data-label={o.label}>{o.label}</span></span>)}
          </div>
        </div>
      )}
      {fe.message}{describe}
    </Stack>
  );
}

/* chips that choose one: a radio group (one tab stop on the chosen chip, arrow keys move and choose) */
function RadioChips({ options, value, onChange, ...rest }: { options: { value: string; label: string }[]; value?: string; onChange: (v: string) => void } & Record<`aria-${string}`, unknown>) {
  const stop = options.some((o) => o.value === value) ? value : options[0]?.value;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight');
    const i = options.findIndex((o) => o.value === stop);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (i + keys[e.key] * (rtl ? -1 : 1) + options.length) % options.length;
    onChange(options[n].value);
    (e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]')[n])?.focus();
  };
  return (
    <div role="radiogroup" {...(rest as object)} onKeyDown={onKey} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Chip key={o.value} role="radio" aria-checked={o.value === value} tabIndex={o.value === stop ? 0 : -1} onClick={() => onChange(o.value)}>{o.label}</Chip>
      ))}
    </div>
  );
}

/* ---- DateTimeInput: date → DatePicker, time → TimePicker, both → the two side by side writing one ISO 8601 value.
   With neither flag the field is date-only, as the reference renderer has it. What the user did not touch (seconds,
   an offset) is kept as it came. A value is compared with `min` and `max` as an instant when both carry an offset,
   and otherwise as text with the time filled to seconds (so 09:30 meets a 09:30:00 minimum). The calendar's limits
   are the bounds' days (a bound with an offset, the day it falls on here). A half of a combined value is kept until
   the other half is chosen, for the value it was chosen against: a new value from the agent drops it. A whole value
   outside the bounds is not written, and says so. */
const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function split(v: string) {
  const m = /^(\d{4}-\d{2}-\d{2})?(?:T?(\d{2}:\d{2}))?(.*)$/.exec(v.trim()) ?? [];
  return { date: m[1] ?? '', time: m[2] ?? '', rest: m[3] ?? '' };
}
const asDate = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined; };
const zoned = (s: string) => /T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s);
/* a time written to the minute gets its seconds, so times of either precision compare as text */
const seconds = (s: string) => s.replace(/(^|T)(\d{2}:\d{2})(?!:\d)/, '$1$2:00');
/** the calendar day a bound falls on, here: its own date, or for one with an offset the local day of that instant */
const boundDay = (b: string) => (zoned(b) && Number.isFinite(Date.parse(b)) ? new Date(Date.parse(b)) : asDate(b));
/** whether `value` is below (`below`) or above the bound */
export function against(value: string, bound: string, below: boolean): boolean {
  if (!bound) return false;
  if (zoned(value) && zoned(bound)) { const a = Date.parse(value), b = Date.parse(bound); return Number.isFinite(a) && Number.isFinite(b) && (below ? a < b : a > b); }
  const b = seconds(bound), v = seconds(value).slice(0, b.length);
  return below ? v < b : v > b;
}
export function A2uiDateTimeInput(r: Rendered<{ value?: unknown; setValue?: (v: string) => void; enableDate?: boolean; enableTime?: boolean; min?: unknown; max?: unknown; label?: unknown }>) {
  const { props } = r;
  const slot = useSlot(r);
  const env = useEnv();
  const label = props.label == null ? undefined : String(props.label);
  const { aria, described, describe } = useAgentName<HTMLElement>(r, label ?? '');
  const time = !!props.enableTime, date = !!props.enableDate || !time;
  const both = date && time;
  const value = props.value == null ? '' : String(props.value);
  const parts = split(value);
  const min = props.min == null ? '' : String(props.min), max = props.max == null ? '' : String(props.max);
  /* the half chosen so far, and a refused whole, for the value they were chosen against */
  const [draft, setDraft] = useState<{ against: string; date?: string; time?: string; refused?: boolean }>({ against: value });
  const own = draft.against === value ? draft : { against: value };
  const fe = useFieldErrors(r, own.refused ? [env.words.range] : []);
  const d = own.date ?? parts.date, t = own.time ?? parts.time;
  const write = (next: { date?: string; time?: string }) => {
    const nd = next.date ?? d, nt = next.time ?? t;
    if (both && (!nd || !nt)) { setDraft({ against: value, date: nd || undefined, time: nt || undefined }); return; }
    const out = both ? `${nd}T${nt}${parts.rest}` : date ? nd : `${nt}${parts.rest}`;
    if (against(out, min, true) || against(out, max, false)) { setDraft({ against: value, date: nd, time: nt, refused: true }); return; }
    setDraft({ against: out });
    props.setValue?.(out);
  };
  const dateLabel = both ? (label ?? env.words.date) : label;
  const timeLabel = both ? env.words.time : label;
  /* a single picker carries the name, description and error itself (Satin's `error` links the message) */
  const single = { ...aria, error: fe.error, 'aria-describedby': described };
  return (
    <Stack ref={fe.host} gap={1} style={fieldBox(r, slot)} onFocus={fe.onFocus} onBlur={fe.onBlur}>
      <Stack direction="row" gap={2} wrap role={both ? 'group' : undefined} aria-label={both ? aria['aria-label'] ?? label : undefined}
        aria-describedby={both ? ids(described, fe.describedBy) : undefined} aria-invalid={both ? fe.invalid : undefined}>
        {date && <DatePicker label={dateLabel} locale={env.locale} value={asDate(d) ?? null} min={boundDay(min)} max={boundDay(max)}
          onChange={(x) => write({ date: isoDate(x) })} {...(both ? {} : single)} />}
        {time && <TimePicker label={timeLabel} locale={env.locale} value={t || null} onChange={(x) => write({ time: x })} {...(date ? {} : single)} />}
      </Stack>
      {both && fe.message}{describe}
    </Stack>
  );
}
