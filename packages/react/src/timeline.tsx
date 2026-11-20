/* Timeline (0.5): things in order — the steps of an order or a request, or a log of events.
   An <ol>; each item has a marker on a line that joins it to the next. The line only connects (design-language 8.1:
   a line, not a groove). Steps (status) and events (tone / icon) are told apart by type:
   - a step is done (a filled mark with a check), current (the position dot, aria-current="step") or upcoming (an
     empty ring); the line after a done step is the accent, the way travelled; shapes, not only colours, tell them
     apart, and a screen reader hears the status (labels.status);
   - an event has a dot in its tone, or its icon on a soft disc of that tone.
   When the current step moves, the move answers it the way a selection moves along its rail: the position dot
   travels along the line to the new step on the smooth spring, stretching the way it goes with the personality's
   squash, and pops into the new ring on arrival; the line it runs along fills in the accent behind it, and each step it
   passes turns done (its check draws) — or back to upcoming when it goes back. Calm: no stretch. Reduced motion:
   the marks change in place.
   An item added (a new event at the top of a log) opens its row on the smooth spring, the line reaching down to the
   next as it does, and its mark pops in; one removed folds its row away first. Reduced motion: it fades in, and goes
   at once. */
import { Children, cloneElement, createContext, isValidElement, useContext, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { animate, loop, motionFor, prefersReducedMotion, Spring } from '@satin-glass/core';
import { cx, useIsoLayoutEffect, type Tone } from './utils';
import { CheckIcon } from './icons';

export type TimelineStatus = 'done' | 'current' | 'upcoming';
type Labels = { status?: Partial<Record<TimelineStatus, string>> };
const LabelsCtx = createContext<Labels | undefined>(undefined);

export type TimelineProps = {
  children: ReactNode;
  /** what a screen reader hears for each status (default Completed / Current / Upcoming) */
  labels?: Labels;
  'aria-label'?: string; 'aria-labelledby'?: string;
  className?: string; style?: CSSProperties;
};

const MARK = 24;   /* the marker box; its centre is where the dot sits */
/* a pop that ends where the element rests: hold the start while it waits, then leave nothing behind (a finished
   animation kept in place keeps a compositing layer) */
const POP_ONLY: KeyframeAnimationOptions = { fill: 'backwards' };

export function Timeline({ children, labels, className, style, ...aria }: TimelineProps) {
  const list = useRef<HTMLOListElement>(null), bead = useRef<HTMLSpanElement>(null);
  const last = useRef<number | null>(null);
  /* items that came and went: the ones removed stay, folding away, until their row is gone */
  const kids = Children.toArray(children).filter(isValidElement) as ReactElement<TimelineItemProps>[];
  const keys = kids.map((k) => String(k.key));
  const seen = useRef<{ keys: string[]; els: Map<string, ReactElement<TimelineItemProps>> } | null>(null);
  const leaving = useRef(new Map<string, { el: ReactElement<TimelineItemProps>; after: string | null }>());
  const entering = useRef(new Set<string>());
  const [, redraw] = useState(0);
  if (seen.current) {
    const prev = seen.current;
    for (const [i, k] of prev.keys.entries()) {
      if (keys.includes(k) || leaving.current.has(k)) continue;
      const after = prev.keys.slice(0, i).reverse().find((x) => keys.includes(x)) ?? null;
      leaving.current.set(k, { el: prev.els.get(k)!, after });
    }
    for (const k of keys) {
      if (leaving.current.delete(k)) continue;   /* back before it had gone */
      if (!prev.keys.includes(k)) entering.current.add(k);
    }
  }
  seen.current = { keys, els: new Map(kids.map((k) => [String(k.key), k])) };
  const shown: ReactElement[] = kids.map((k) => cloneElement(k, { itemKey: String(k.key) } as Partial<TimelineItemProps>));
  for (const [k, { el, after }] of leaving.current) {
    const at = after === null ? 0 : shown.findIndex((x) => String(x.key) === after) + 1;
    shown.splice(at, 0, cloneElement(el, { key: k, itemKey: k, phase: 'leave' } as Partial<TimelineItemProps>));
  }

  /* the current step moved: the dot travels to it. One spring for the dot, kept across moves: a new step chosen while
     it travels turns it from where it is, at the speed it has. Every step's look follows the dot — done above it,
     upcoming below it, current once the dot has reached it — so quick presses can never leave a stale mark; at rest
     each step takes its own status again (data-status, which only React writes). */
  const dot = useRef<{ s: Spring; stop: (() => void) | null; ring: (() => void) | null } | null>(null);
  useIsoLayoutEffect(() => {
    const ol = list.current, b = bead.current;
    if (!ol || !b) return;
    const steps = (Array.from(ol.children) as HTMLElement[]).filter((e) => e.dataset.kind === 'step' && e.dataset.phase !== 'leave');
    const to = steps.findIndex((li) => li.getAttribute('aria-current') === 'step');
    const from = last.current;
    last.current = to;
    if (from === null || from === to) return;
    const d = dot.current, moving = !!d?.stop;
    const rest = () => {
      ol.dataset.landing = '';
      for (const li of steps) { li.dataset.look = li.dataset.status!; delete li.dataset.pass; delete li.dataset.arriving; li.style.removeProperty('--_fill'); }
      delete ol.dataset.moving; b.style.display = '';
      requestAnimationFrame(() => requestAnimationFrame(() => { delete ol.dataset.landing; }));
    };
    if (to < 0 || prefersReducedMotion(ol) || (from < 0 && !moving)) { d?.stop?.(); if (d) d.stop = null; rest(); return; }

    /* lay the new state out with no transitions (React's new looks would otherwise start fading before the looks the
       dot holds are set); they come back next frame, for the steps the dot passes */
    ol.dataset.hold = '';
    const pos = steps.map((li) => { const m = li.querySelector<HTMLElement>('.sg-timeline__marker')!; return { x: li.offsetLeft + m.offsetLeft + MARK / 2, y: li.offsetTop + m.offsetTop + MARK / 2, top: li.offsetTop + 28, bottom: li.offsetTop + li.offsetHeight - 4 }; });
    const sq = motionFor(ol).squash, z = pos[to];
    let s: Spring;
    if (moving) { s = d!.s; d!.stop!(); } else { s = new Spring(pos[from].y, 'smooth', ol); }
    s.target = z.y;
    const dir = s.target >= s.value ? 1 : -1;
    const run0 = dot.current = { s, stop: null as (() => void) | null, ring: d?.ring ?? null };
    for (const [i, li] of steps.entries()) { if (i < steps.length - 1) li.dataset.pass = ''; if (i === to) li.dataset.arriving = ''; else delete li.dataset.arriving; }
    ol.dataset.moving = '';
    b.style.display = 'block';

    /* the ring takes the dot: as it arrives, the ring is pushed in (a velocity, not a jump) and springs back past its
       size on the pop spring — a shrink and a swell that start from where it is */
    const ring = steps[to].querySelector<HTMLElement>('.sg-timeline__marker');
    const knock = () => {
      if (!ring) return;
      run0.ring?.();
      const R = new Spring(1, 'pop', ol); R.velocity = -(2 + sq * 8);
      /* settled in scale units (the spring's own test is for pixels) */
      const off = loop((dt) => {
        R.step(dt); ring.style.transform = `scale(${R.value.toFixed(4)})`;
        if (Math.abs(R.value - 1) > 0.001 || Math.abs(R.velocity) > 0.02) return;
        ring.style.transform = ''; run0.ring = null;
        return false;
      });
      run0.ring = () => { off(); ring.style.transform = ''; run0.ring = null; };
    };
    /* the dot stays on its rail: past the step it is going to, the spring's overshoot presses it flat there instead
       (a switch knob reaching its end); while it travels it stretches the way it goes */
    let arrived = false;
    const paint = () => {
      const over = (s.value - z.y) * dir;
      const y = over > 0 ? z.y : s.value;
      const k = Math.min(sq * 3, (Math.abs(s.velocity) / 900) * sq * 4);
      const press = over > 0 ? Math.min(0.45, over / 10) : 0;
      const sy = press ? 1 - press : 1 + k, sx = press ? 1 + press * 0.6 : 1 - k * 0.35;
      b.style.transform = `translate(${z.x - 4}px, ${y - 4}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      if (!arrived && Math.abs(y - z.y) < 0.5) { arrived = true; delete steps[to].dataset.arriving; knock(); }
      for (const [i, li] of steps.entries()) {
        /* the line it runs along fills in the accent down to the dot (each keeps its gaps by the marks) */
        if (i < steps.length - 1) li.style.setProperty('--_fill', Math.max(0, Math.min(1, (y - pos[i].top) / (pos[i].bottom - pos[i].top || 1))).toFixed(4));
        const look = i === to && arrived ? 'current' : pos[i].y < y - 0.5 ? 'done' : pos[i].y > y + 0.5 ? 'upcoming' : null;
        if (look && li.dataset.look !== look) li.dataset.look = look;
      }
    };
    paint();
    requestAnimationFrame(() => { delete ol.dataset.hold; });
    run0.stop = loop((dt) => {
      s.step(dt); paint();
      /* landed once it is in place to the eye (the spring's sub-pixel tail would hold the ring back) */
      if (!(arrived && Math.abs(s.value - z.y) < 0.5 && Math.abs(s.velocity) < 30)) return;
      s.jump(s.target); paint(); rest();
      run0.stop = null;
      return false;
    });
  });
  useIsoLayoutEffect(() => () => { dot.current?.stop?.(); dot.current?.ring?.(); }, []);

  /* rows that came open, rows that went fold away */
  const rows = useRef(new Map<string, () => void>());
  useIsoLayoutEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const reduced = prefersReducedMotion(ol), sq = motionFor(ol).squash;
    for (const li of Array.from(ol.querySelectorAll<HTMLElement>(':scope > .sg-timeline__item'))) {
      const k = li.dataset.key!, leave = li.dataset.phase === 'leave';
      if (!leave && !entering.current.has(k)) continue;
      if (!leave) entering.current.delete(k);
      rows.current.get(k)?.();
      if (reduced) {
        if (leave) { leaving.current.delete(k); redraw((n) => n + 1); }
        else li.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, fill: 'backwards' });
        continue;
      }
      /* a finished animation left in place (the mark's pop) keeps a layer of its own, which Safari does not clip with the
         folding row: it showed as a broken afterimage. Nothing of it is visible any more, so it goes */
      if (leave) for (const a of li.getAnimations({ subtree: true })) a.cancel();
      const full = li.scrollHeight, pad = parseFloat(getComputedStyle(li).paddingBottom) || 0;
      const from = leave ? li.getBoundingClientRect().height : 0;
      const s = new Spring(from, 'smooth', ol); s.target = leave ? 0 : full;
      /* the gap under a row is its padding: it opens and folds with the row, so a row can reach none */
      const size = (h: number) => { li.style.height = `${h.toFixed(2)}px`; li.style.paddingBottom = `${(pad * Math.min(1, h / (full || 1))).toFixed(2)}px`; };
      li.style.overflow = 'hidden'; size(from);
      const mark = li.querySelector<HTMLElement>('.sg-timeline__marker');
      if (!leave && mark) mark.style.transform = 'scale(0.4)';
      let popped = leave;
      const done = () => { li.style.overflow = ''; li.style.height = ''; li.style.paddingBottom = ''; if (mark) mark.style.transform = ''; rows.current.delete(k); };
      const stop = loop((dt) => {
        s.step(dt);
        const shut = leave && s.value <= 0.5;
        if (shut) s.jump(0);
        size(Math.max(0, s.value));
        /* the mark pops in once its row has room for it */
        if (!popped && mark && s.value >= Math.min(full, 26)) { popped = true; mark.style.transform = ''; animate(mark, [{ transform: `scale(${(0.6 - sq).toFixed(2)})` }, { transform: 'none' }], 'pop', POP_ONLY); }
        if (!shut && !s.settled) return;
        /* a row that went stays folded until React takes it out: clearing its size first showed it whole again for a
           frame before the render (the screen flashed on a phone) */
        if (leave) { rows.current.delete(k); leaving.current.delete(k); redraw((n) => n + 1); } else done();
        return false;
      });
      rows.current.set(k, () => { stop(); done(); });
    }
  });
  useIsoLayoutEffect(() => () => { for (const stop of rows.current.values()) stop(); }, []);

  return (
    <LabelsCtx.Provider value={labels}>
      <ol ref={list} className={cx('sg-timeline', className)} style={style} {...aria}>
        {shown}
        <span ref={bead} className="sg-timeline__bead" aria-hidden="true" />
      </ol>
    </LabelsCtx.Provider>
  );
}

type ItemBase = {
  /** (internal: set by Timeline — the item's key, and 'leave' on one folding away) */
  itemKey?: string; phase?: 'leave';
  title: ReactNode;
  description?: ReactNode;
  /** when it happened; a <time dateTime="…"> is best */
  time?: ReactNode;
  className?: string; style?: CSSProperties;
};
export type TimelineItemProps = ItemBase & (
  /** a step in a sequence */
  | { status: TimelineStatus; tone?: never; icon?: never }
  /** an event in a log */
  | { status?: never; tone?: Tone; icon?: ReactNode }
);

const STATUS: Record<TimelineStatus, string> = { done: 'Completed', current: 'Current', upcoming: 'Upcoming' };

export function TimelineItem({ title, description, time, status, tone, icon, itemKey, phase, className, style }: TimelineItemProps) {
  const labels = useContext(LabelsCtx);
  const kind = status ? 'step' : icon ? 'icon' : 'event';
  return (
    <li className={cx('sg-timeline__item', className)} style={style} data-key={itemKey} data-phase={phase} data-kind={kind} data-status={status ?? kind} data-look={status ?? kind} data-tone={status ? undefined : tone ?? 'neutral'}
      aria-current={status === 'current' ? 'step' : undefined}>
      <span className="sg-timeline__marker" aria-hidden="true">
        {status ? <CheckIcon className="sg-timeline__check" /> : icon}
      </span>
      <div className="sg-timeline__body">
        <div className="sg-timeline__head">
          <span className="sg-timeline__title">
            {title}
            {status && <span className="sg-visually-hidden">{`, ${labels?.status?.[status] ?? STATUS[status]}`}</span>}
          </span>
          {time && <span className="sg-timeline__time">{time}</span>}
        </div>
        {description && <div className="sg-timeline__desc">{description}</div>}
      </div>
    </li>
  );
}
