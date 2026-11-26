/* What every A2UI component here shares: the session's environment (words, icons, URL policy, diagnostics), the
   binder's props, child building, and the accessible-name policy. */
import { createContext, Fragment, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Text, VisuallyHidden } from '@satin-glass/react';
import { checkText, type A2uiWords } from '../words';
import type { AllowUrl } from '../urls';

export type Diagnostic = { code: 'label-conflict' | 'missing-icon' | 'untitled-modal' | 'refused-url' | 'refused-pattern'; surfaceId?: string; componentId: string; message: string };
export type Env = {
  /** the session's language: the built-in words, and the pickers' formats */
  locale: string;
  words: A2uiWords;
  icons: Record<string, ReactNode>;
  allowUrl: AllowUrl;
  warn: (d: Diagnostic) => void;
};
export const EnvContext = createContext<Env | null>(null);
/** how many agent Cards enclose this point: the outermost is drawn as a surface card, any inside it with a hairline
    (design language §8: a surface on a surface does not lift again). A Modal's dialog starts again at 0. */
export const CardDepthContext = createContext(0);
/** where the app draws the surfaces: on the page (the outermost agent Card lifts as a surface card) or already on a
    surface of the app's own (every agent Card keeps to it, with a hairline). Set by A2uiProvider, read by the
    surfaces; undefined: not said */
export type Ground = 'page' | 'surface';
/** a child drawn at an agent Card's edge: the Card names its child (`all`), and a stretched, unweighted Column that is
    that child names its first (`top`) and last (`bottom`) children. Matched by component ID, so only that child reads
    it, not what is inside it. An image there is drawn edge to edge (design language §9: a flush child is clipped by
    its parent). */
export type Edge = 'top' | 'bottom' | 'all';
export const EdgeContext = createContext<{ id: string; edge: Edge } | null>(null);
/** `.sg-card__body`'s padding (packages/core/styles/layout.css), which an edge image steps over */
export const BODY_PAD = { top: 14, inline: 16, bottom: 16 } as const;
/** a Row's children as the agent wrote their IDs: a weighted Column or Card among them is a panel, which keeps a
    minimum width so that a narrow Row stacks its panels instead of squeezing them (WCAG 1.4.10 reflow). Matched by
    ID, so only the Row's own children read it. */
export const RowContext = createContext<string[] | null>(null);
/** a Row's or Column's children as the agent wrote their IDs (a template's instances share its ID), and its `align`:
    in a Column, a direct child that has no width of its own (a nested Column, a Row that spreads its children, a
    field) takes the Column's width whatever its alignment; an image keeps its own size and is not stretched. Matched
    by ID, as RowContext, so only the flow's own children read it. */
export const FlowContext = createContext<{ direction: 'row' | 'column'; ids: string[]; align: string; aligned: boolean; media: boolean } | null>(null);
/** where a component sits: a direct child of a Column or of a Row, and that flow's alignment */
export function useSlot(r: Rendered<unknown>) {
  const flow = useContext(FlowContext), row = useContext(RowContext), id = r.context.componentModel.id;
  const mine = !!flow?.ids.includes(id);
  return {
    inColumn: mine && flow?.direction === 'column', inRow: !!row?.includes(id), align: mine ? flow?.align : undefined,
    /* the Row's agent gave no `align` (texts of different sizes then share a baseline), and the Row holds a feature
       image beside its content (the content wraps below it when there is no room) */
    unaligned: mine && flow?.direction === 'row' && !flow.aligned, mediaRow: mine && flow?.direction === 'row' && flow.media,
  };
}
/** a field's outer box: its weight, and in a Column the Column's whole width (a field has no width of its own) */
export function fieldBox(r: Rendered<unknown>, slot: ReturnType<typeof useSlot>): CSSProperties {
  return { ...grow(r.props.weight), ...(slot.inColumn ? { alignSelf: 'stretch' } : {}), ...(slot.inRow && !r.props.weight ? { minWidth: 0 } : {}) };
}
/** a panel's minimum width in a Row */
export const PANEL_MIN = 'min(15rem, 100%)';
/** the narrowest the text beside a feature image in a Row may get before it goes below the image */
export const MEDIA_TEXT_MIN = 'min(9rem, 100%)';
/** inside an agent Button: a plain Text there is the button's label, in the button's own type */
export const InButtonContext = createContext(false);
/** inside a Modal's trigger: the trigger is the press target, so nothing inside it becomes a button of its own */
export const InTriggerContext = createContext(false);
export const GroundContext = createContext<Ground | undefined>(undefined);
/** the ID of the surface a component is drawn in; carried by React context, so it reaches into portals (dialogs) */
export const SurfaceIdContext = createContext<string | undefined>(undefined);
export const useEnv = () => {
  const env = useContext(EnvContext);
  if (!env) throw new Error('@satin-glass/a2ui: render surfaces with <A2uiSurfaces> or <A2uiSurface>, or inside <A2uiProvider>');
  return env;
};

export type Child = string | { id: string; basePath: string };
export type Build = (id: string, basePath?: string) => ReactNode;
type A11y = { label?: string; description?: string };
/** what web_core's binder hands a render function: resolved values, setters, actions and check results */
type Subscribable<T> = { subscribe(listener: (data: T) => void): { unsubscribe(): void } };
export type Rendered<P> = {
  props: P & { weight?: number; isValid?: boolean; validationErrors?: string[]; accessibility?: A11y; '@accessibility'?: A11y };
  buildChild: Build;
  context: { componentModel: { id: string; properties: Record<string, unknown> }; surfaceComponents?: {
    get(id: string): { type: string; properties?: Record<string, unknown>; onUpdated?: Subscribable<unknown> } | undefined; has(id: string): boolean;
    onCreated?: Subscribable<{ id: string }>; onDeleted?: Subscribable<string>;
  } };
  accessibilityRef?: (el: Element | null) => void;
};

export const kids = (list: Child[] | undefined, build: Build) =>
  (list ?? []).map((c) => (typeof c === 'string'
    ? <Fragment key={c}>{build(c)}</Fragment>
    : <Fragment key={`${c.id}@${c.basePath}`}>{build(c.id, c.basePath)}</Fragment>));

/** a component's share of its Row's or Column's main axis */
export const grow = (weight?: number): CSSProperties | undefined => (weight ? { flex: `${weight} 1 0`, minWidth: 0 } : undefined);

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
/** the label and description an agent gave a component: `@accessibility` (v1.0) or `accessibility` (v0.9.1) */
export function agentA11y(r: Rendered<unknown>): A11y {
  const own = (r.props['@accessibility'] ?? r.props.accessibility ?? r.context.componentModel.properties['@accessibility'] ?? r.context.componentModel.properties.accessibility) as A11y | undefined;
  return { label: text(own?.label), description: text(own?.description) };
}

/* words of a name, for the containment test: case-insensitive, split on spaces and punctuation */
const words = (s: string) => s.toLocaleLowerCase().split(/[\s\p{P}]+/u).filter(Boolean);
/** whether `label` contains `visible` as whole words, in order (WCAG 2.5.3: "3 페이지" holds "3", "3페이지" does not) */
export function holdsWords(label: string, visible: string) {
  const l = words(label), v = words(visible);
  if (!v.length) return true;
  for (let i = 0; i + v.length <= l.length; i++) if (v.every((w, k) => l[i + k] === w)) return true;
  return false;
}

/** points web_core's host binding (label, description, aria-invalid) at a detached element: this package decides them */
export function useHostSink(r: Rendered<unknown>) {
  const sink = useMemo(() => (typeof document !== 'undefined' ? document.createElement('span') : null), []);
  const point = r.accessibilityRef;
  useLayoutEffect(() => { point?.(sink); }, [point, sink]);
}


/**
 * The accessible-name policy. web_core's host would write the agent's label over the control's own name and set
 * `aria-invalid` before any error shows. So this decides:
 * - the agent's label names the control when the control shows no text, or when the label holds that text as whole
 *   words (the host's binding is then pointed at a detached element, and the label is set on the control here);
 * - otherwise the visible text stays the control's name, the label names the component's host as a group (the
 *   host's own binding, pointed back at itself), and a diagnostic names the surface and the component.
 * `visible` is the control's visible text when it is known while rendering; otherwise it is read from the element,
 * and read again whenever its text changes (a bound child Text updates on its own).
 */
export function useAgentName<E extends HTMLElement>(r: Rendered<unknown>, visible?: string) {
  const env = useEnv();
  const surfaceId = useContext(SurfaceIdContext);
  const { label, description } = agentA11y(r);
  const [el, setEl] = useState<E | null>(null);
  const [shown, setShown] = useState<string | undefined>(visible);
  useLayoutEffect(() => {
    if (visible !== undefined) { setShown(visible); return; }
    if (!el) return;
    const read = () => setShown(el.textContent?.trim() ?? '');
    read();
    if (typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(read);
    mo.observe(el, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, [el, visible]);
  const fits = !label || !shown || holdsWords(label, shown);
  const sink = useMemo(() => (typeof document !== 'undefined' ? document.createElement('span') : null), []);
  const point = r.accessibilityRef;
  useLayoutEffect(() => { point?.(fits ? sink : null); }, [point, sink, fits]);
  const id = r.context.componentModel.id;
  const warned = useRef('');
  useLayoutEffect(() => {
    if (fits || !label || warned.current === `${label}|${shown}`) return;
    warned.current = `${label}|${shown}`;
    env.warn({ code: 'label-conflict', surfaceId, componentId: id, message: `The agent's label "${label}" does not contain the visible text "${shown}" as words; the visible text stays the control's name and the label names its group.` });
  });
  /* the agent's description, read with the control: a visually hidden element it points to (aria-describedby is read
     by every screen reader; aria-description is not) */
  const descId = useId();
  const aria: { 'aria-label'?: string } = {};
  if (label && fits) aria['aria-label'] = label;
  const described = description && fits ? descId : undefined;
  const describe = described ? <VisuallyHidden id={descId}>{description}</VisuallyHidden> : null;
  return { ref: setEl as (node: E | null) => void, aria, described, describe };
}

/** the ids that describe a control, joined (the agent's description, an error, a reason) */
export const ids = (...list: (string | undefined)[]) => list.filter(Boolean).join(' ') || undefined;

/**
 * Check messages for a field: shown once the user has left it, linked to the control with `aria-describedby`, and
 * `aria-invalid` only while one shows, so what is announced matches what is seen. Leaving is judged through React's
 * focus events, which follow portals: opening a picker's panel is not leaving the field. A message the agent did not
 * write (web_core's own) is shown in the session's language.
 */
export function useFieldErrors(r: Rendered<unknown>, own: string[] = []) {
  const env = useEnv();
  const [left, setLeft] = useState(false);
  const id = useId();
  const inside = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const errors = [...(r.props.validationErrors ?? []).map((m) => checkText(String(m), env.words)), ...own].filter(Boolean);
  const shown = left && errors.length ? [...new Set(errors)].join(' ') : undefined;
  return {
    error: shown,
    /** on the field's outermost element (or the control itself): focus coming in */
    onFocus: () => { inside.current = true; },
    /** on the same element: focus going out, judged once focus has settled (it may move into the field's own panel) */
    onBlur: () => { inside.current = false; clearTimeout(timer.current); timer.current = setTimeout(() => { if (!inside.current) setLeft(true); }, 0); },
    describedBy: shown ? id : undefined,
    invalid: shown ? true : undefined,
    message: shown ? <Text id={id} variant="footnote" tone="danger">{shown}</Text> : null,
  };
}
