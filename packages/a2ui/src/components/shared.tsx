/* What every A2UI component here shares: the session's environment (words, icons, URL policy, diagnostics), the
   binder's props, child building, and the accessible-name policy. */
import { createContext, Fragment, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Text, VisuallyHidden } from '@satin-glass/react';
import { checkText, type A2uiWords } from '../words';
import type { AllowUrl } from '../urls';

export type Diagnostic = { code: 'label-conflict' | 'missing-icon' | 'untitled-modal' | 'refused-url' | 'refused-pattern'; surfaceId?: string; componentId: string; message: string };
export type Env = {
  words: A2uiWords;
  icons: Record<string, ReactNode>;
  allowUrl: AllowUrl;
  warn: (d: Diagnostic) => void;
};
export const EnvContext = createContext<Env | null>(null);
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
export type Rendered<P> = {
  props: P & { weight?: number; isValid?: boolean; validationErrors?: string[]; accessibility?: A11y; '@accessibility'?: A11y };
  buildChild: Build;
  context: { componentModel: { id: string; properties: Record<string, unknown> }; surfaceComponents?: { get(id: string): { type: string } | undefined; has(id: string): boolean } };
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
