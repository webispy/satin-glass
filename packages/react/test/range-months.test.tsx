import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { RangeCalendar, DateRangePicker, Calendar } from '../src';

/* two months side by side (#5) */
/* a ResizeObserver that reports, as a browser's does, as soon as it observes a range calendar's box: it is this wide.
   Other boxes are not reported (jsdom lays nothing out: an anchor would read as hidden), as the setup's stand-in */
let room = 1280;
const SetupRO = globalThis.ResizeObserver;
class ReportingRO {
  constructor(private cb: ResizeObserverCallback) {}
  observe(el: Element) { if (el.classList.contains('sg-rangecalendar')) this.cb([{ contentRect: { width: room } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver); }
  unobserve() {} disconnect() {}
}
beforeEach(() => { room = 1280; globalThis.ResizeObserver = ReportingRO as unknown as typeof ResizeObserver; });
afterEach(() => { globalThis.ResizeObserver = SetupRO; });
const d = (y: number, m: number, dd: number) => new Date(y, m, dd, 12);
const grids = (c: HTMLElement) => [...c.querySelectorAll('table[role="grid"]')].map((t) => t.getAttribute('aria-label'));
const dayIn = (c: ParentNode, iso: string) => c.querySelector<HTMLButtonElement>(`.sg-day[data-date="${iso}"]`)!;
const focusedDate = () => document.activeElement?.getAttribute('data-date');

describe('RangeCalendar months={2} (#5)', () => {
  it('shows two months, each grid named by its month, the pair announced and the caller naming the group; each day once', () => {
    const { container } = render(<RangeCalendar months={2} aria-label="Stay" defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    expect(grids(container)).toEqual(['November 2026', 'December 2026']);
    expect(screen.getByRole('group', { name: 'Stay' })).toBeTruthy();
    expect(container.querySelector('h2')!.textContent).toMatch(/November.*December 2026/);
    /* the other months' days are blanks: no button, so no date twice */
    expect(container.querySelectorAll('.sg-day[data-outside]').length).toBe(0);
    const dates = [...container.querySelectorAll('.sg-day')].map((b) => b.getAttribute('data-date'));
    expect(dates.length).toBe(61);
    expect(new Set(dates).size).toBe(61);
    /* one tab stop across both */
    expect(container.querySelectorAll('.sg-day[tabindex="0"]').length).toBe(1);
  });

  it('one month when left out, and when min and max are in one month', () => {
    const one = render(<RangeCalendar aria-label="a" defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    expect(one.container.querySelectorAll('table[role="grid"]').length).toBe(1);
    one.unmount();
    const bound = render(<RangeCalendar months={2} aria-label="b" min={d(2026, 10, 3)} max={d(2026, 10, 20)} defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    expect(bound.container.querySelectorAll('table[role="grid"]').length).toBe(1);
  });

  it('the arrow keys cross between the months; past the second, the pair moves one month', () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    act(() => dayIn(container, '2026-11-30').focus());
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(focusedDate()).toBe('2026-12-01');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(focusedDate()).toBe('2026-11-24');
    act(() => dayIn(container, '2026-12-31').focus());
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(focusedDate()).toBe('2027-01-01');
    expect(grids(container)).toEqual(['December 2026', 'January 2027']);
    /* PageUp moves the day a month; the pair stays, as December is shown */
    fireEvent.keyDown(document.activeElement!, { key: 'PageUp' });
    expect(focusedDate()).toBe('2026-12-01');
    expect(grids(container)).toEqual(['December 2026', 'January 2027']);
    /* before the first month, the pair moves back one */
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(focusedDate()).toBe('2026-11-30');
    expect(grids(container)).toEqual(['November 2026', 'December 2026']);
  });

  it('the arrows move one month; a start picked in the second month leaves the pair; an outside start in neither moves it', () => {
    const { container, rerender } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(grids(container)).toEqual(['December 2026', 'January 2027']);
    fireEvent.click(dayIn(container, '2027-01-10'));
    expect(grids(container)).toEqual(['December 2026', 'January 2027']);
    rerender(<RangeCalendar months={2} aria-label="s" value={{ start: d(2027, 4, 2), end: d(2027, 4, 9) }} locale="en-US" />);
    expect(grids(container)).toEqual(['May 2027', 'June 2027']);
    /* an end in the second month of what is shown leaves it too */
    rerender(<RangeCalendar months={2} aria-label="s" value={{ start: d(2027, 4, 2), end: d(2027, 5, 9) }} locale="en-US" />);
    expect(grids(container)).toEqual(['May 2027', 'June 2027']);
  });

  it('max: the pair ends on its month, which a value there shows second; the next arrow stops there', () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" max={d(2026, 11, 15)} value={{ start: d(2026, 11, 3), end: d(2026, 11, 5) }} locale="en-US" />);
    expect(grids(container)).toEqual(['November 2026', 'December 2026']);
    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a range of one day names the day as both its start and its end', () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    fireEvent.click(dayIn(container, '2026-12-10'));
    fireEvent.click(dayIn(container, '2026-12-10'));
    expect(dayIn(container, '2026-12-10').textContent).toMatch(/start date, end date$/);
  });
});

describe('RangeCalendar months={2}: bounds and the pickers (#5, review)', () => {
  const stops = (c: HTMLElement) => [...c.querySelectorAll('.sg-day[tabindex="0"]')].map((b) => b.getAttribute('data-date'));
  it('a view held by min keeps one tab stop, in the months shown', () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 3, 1)} min={d(2026, 8, 10)} locale="en-US" />);
    expect(grids(container)).toEqual(['September 2026', 'October 2026']);
    expect(stops(container)).toEqual(['2026-09-10']);
  });
  it('min and max in one month: that month is shown, even from a defaultMonth elsewhere, with its tab stop', () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 3, 1)} min={d(2026, 8, 10)} max={d(2026, 8, 20)} locale="en-US" />);
    expect(container.querySelectorAll('table[role="grid"]').length).toBe(1);
    expect(container.querySelector('h2')!.textContent).toBe('September 2026');
    expect(stops(container)).toEqual(['2026-09-10']);
  });
  it('the last month can be chosen in the pickers: it shows second, the pickers keep it', () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} max={d(2027, 0, 20)} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: /pick year|year/i, expanded: false }));
    fireEvent.click(screen.getByRole('option', { name: '2027' }));
    /* on to the months of 2027, not back to 2026 (the pair's first month is December 2026) */
    expect(container.querySelector('.sg-calendar__caption')!.textContent).toBe('2027');
    fireEvent.click(screen.getByRole('option', { name: 'January' }));
    expect(grids(container)).toEqual(['December 2026', 'January 2027']);
    expect(stops(container)[0]!.startsWith('2027-01')).toBe(true);
  });
});

describe('DateRangePicker months={2} (#5)', () => {
  const width = window.innerWidth;
  const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  afterEach(() => setWidth(width));
  it('two months when the window holds them (632 px), one below', () => {
    const value = { start: d(2026, 10, 26), end: d(2026, 11, 4) };
    setWidth(1280);
    const wide = render(<DateRangePicker months={2} aria-label="Stay" value={value} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: /Stay|Nov/ }));
    expect(grids(document.body)).toEqual(['November 2026', 'December 2026']);
    wide.unmount();
    setWidth(631);
    render(<DateRangePicker months={2} aria-label="Stay" value={value} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: /Stay|Nov/ }));
    expect(document.body.querySelectorAll('table[role="grid"]').length).toBe(1);
  });
  it('months set to 2 while it is open takes the window as it is now', () => {
    const value = { start: d(2026, 10, 26), end: d(2026, 11, 4) };
    setWidth(500);
    const { rerender } = render(<DateRangePicker aria-label="Stay" value={value} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: /Stay|Nov/ }));
    setWidth(1280);
    rerender(<DateRangePicker months={2} aria-label="Stay" value={value} locale="en-US" />);
    expect(grids(document.body)).toEqual(['November 2026', 'December 2026']);
  });
});

describe('months={2}: points from the review of #138', () => {
  const stops = (c: ParentNode) => [...c.querySelectorAll('.sg-day[tabindex="0"]')].map((b) => b.getAttribute('data-date'));
  const width = window.innerWidth;
  const setWidth = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  afterEach(() => setWidth(width));

  it('a picker too narrow for two still keeps its view within min and max', () => {
    setWidth(631);
    render(<DateRangePicker months={2} aria-label="Stay" defaultMonth={d(2026, 3, 1)} min={d(2026, 8, 10)} max={d(2026, 9, 20)} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(document.body.querySelector('h2')!.textContent).toBe('September 2026');
    expect(stops(document.body)).toEqual(['2026-09-10']);
  });

  /* a picker resized while open: in the browser (tests/e2e/range.mjs); jsdom lays nothing out, so the panel reads
     its anchor as hidden on a resize and closes */

  it('a plain Calendar: the month picker opens on the month its header names', () => {
    const { container } = render(<Calendar aria-label="c" defaultMonth={d(2026, 11, 1)} min={d(2027, 0, 1)} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: /Choose a month/ }));
    expect(container.querySelector('.sg-calendar__caption')!.textContent).toBe('2026');
  });

  it('autoFocus goes to the tab stop, which stays within min', () => {
    render(<RangeCalendar months={2} autoFocus aria-label="s" defaultMonth={d(2026, 8, 1)} min={d(2026, 8, 10)} locale="en-US" />);
    expect(focusedDate()).toBe('2026-09-10');
  });

  it('until the container is measured, the tab stop is in the first month and the title waits', () => {
    globalThis.ResizeObserver = SetupRO;   /* never reports: not measured yet */
    {
      const { container } = render(<RangeCalendar months={2} aria-label="s" max={d(2026, 11, 15)} value={{ start: d(2026, 11, 3), end: d(2026, 11, 5) }} locale="en-US" />);
      expect(grids(container)).toEqual(['November 2026', 'December 2026']);
      expect(stops(container)[0]!.startsWith('2026-11')).toBe(true);
      expect(container.querySelector('h2')!.textContent).toBe('');
    }
  });

  it('Home, End and PageDown cross the seam', () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    /* November 30 2026 is a Monday: End is Saturday December 5, Home from there Sunday November 29 */
    act(() => dayIn(container, '2026-11-30').focus());
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(focusedDate()).toBe('2026-12-05');
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(focusedDate()).toBe('2026-11-29');
    /* PageDown from November 29: December 29, in view; again: January 29, the pair moves one month */
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown' });
    expect(focusedDate()).toBe('2026-12-29');
    expect(grids(container)).toEqual(['November 2026', 'December 2026']);
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown' });
    expect(focusedDate()).toBe('2027-01-29');
    expect(grids(container)).toEqual(['December 2026', 'January 2027']);
  });
});

describe('months={2}: around the first measurement (#138, second review)', () => {
  /* a ResizeObserver that reports only when the test says (`report(width)`), as a browser's does after layout */
  let pending: ((w: number) => void)[] = [];
  class LaterRO {
    constructor(private cb: ResizeObserverCallback) {}
    observe(el: Element) { if (el.classList.contains('sg-rangecalendar')) pending.push((w) => this.cb([{ contentRect: { width: w } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)); }
    unobserve() {} disconnect() {}
  }
  const report = (w: number) => act(() => { for (const f of pending) f(w); });
  beforeEach(() => { pending = []; globalThis.ResizeObserver = LaterRO as unknown as typeof ResizeObserver; });

  it('autoFocus waits for the measurement, then takes the tab stop it gives', () => {
    render(<RangeCalendar months={2} autoFocus aria-label="s" max={d(2026, 11, 31)} value={{ start: d(2026, 11, 10), end: d(2026, 11, 12) }} locale="en-US" />);
    /* not measured: the tab stop is in November, the first month; nothing is focused yet */
    expect(document.activeElement?.classList.contains('sg-day')).toBe(false);
    report(400);   /* one month: December, the value's */
    expect(focusedDate()).toBe('2026-12-10');
  });

  it('the focus given back after a resize is not taken from a control focused meanwhile', async () => {
    const { container } = render(<><RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" /><input aria-label="other" /></>);
    report(1280);
    act(() => dayIn(container, '2026-12-15').focus());
    report(400);   /* the second grid goes, and the focus with it */
    act(() => (screen.getByRole('textbox', { name: 'other' }) as HTMLInputElement).focus());
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'other' }));
  });

  it('…and is given back when nothing took it', async () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    report(1280);
    act(() => dayIn(container, '2026-12-15').focus());
    report(400);
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    expect(focusedDate()).toBe('2026-12-15');
  });

  it('one month known without measuring (min and max in one month): the grid has its name at once', () => {
    const { container } = render(<RangeCalendar months={2} min={d(2026, 8, 3)} max={d(2026, 8, 20)} defaultMonth={d(2026, 8, 1)} locale="en-US" />);
    expect(container.querySelector('h2')!.textContent).toBe('September 2026');
  });
});

describe('months={2}: focus races (#138, third review)', () => {
  let pending: ((w: number) => void)[] = [];
  class LaterRO {
    constructor(private cb: ResizeObserverCallback) {}
    observe(el: Element) { if (el.classList.contains('sg-rangecalendar')) pending.push((w) => this.cb([{ contentRect: { width: w } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)); }
    unobserve() {} disconnect() {}
  }
  const report = (w: number) => act(() => { for (const f of pending) f(w); });
  const frame = () => act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
  beforeEach(() => { pending = []; globalThis.ResizeObserver = LaterRO as unknown as typeof ResizeObserver; });

  it('autoFocus waiting for the measurement does not take the focus from a control the app focused meanwhile', () => {
    render(<><RangeCalendar months={2} autoFocus aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" /><input aria-label="other" /></>);
    const other = screen.getByRole('textbox', { name: 'other' });
    act(() => other.focus());
    report(1280);
    expect(document.activeElement).toBe(other);
  });

  it('focus given back once: a later resize does not pull it back after the user left', async () => {
    const { container } = render(<><RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" /><input aria-label="other" /></>);
    report(1280);
    act(() => dayIn(container, '2026-12-15').focus());
    report(400);
    act(() => (screen.getByRole('textbox', { name: 'other' }) as HTMLInputElement).focus());   /* before the frame */
    await frame();
    act(() => (document.activeElement as HTMLElement).blur());   /* a press on blank page: the body has it */
    report(1280);
    await frame();
    expect(document.activeElement).toBe(document.body);
  });

  it('a press outside the calendar before the frame cancels giving the focus back', async () => {
    const { container } = render(<><RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" /><p>text</p></>);
    report(1280);
    act(() => dayIn(container, '2026-12-15').focus());
    report(400);
    fireEvent.pointerDown(screen.getByText('text'));
    await frame();
    expect(document.activeElement).toBe(document.body);
  });

  it('the next arrow, disabled as max\'s month comes in on widening, hands the focus to the days', async () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} max={d(2026, 11, 31)} locale="en-US" />);
    report(400);   /* one month: November, the next arrow enabled */
    const next = screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    act(() => next.focus());
    report(1280);   /* November and December: the arrow is disabled with the focus on it */
    expect(next.disabled).toBe(true);
    await frame();
    expect(document.activeElement?.classList.contains('sg-day')).toBe(true);
    expect(container.contains(document.activeElement)).toBe(true);
  });

  it('bounds alone in one month, no value or defaultMonth: the server writes the month and its name', () => {
    const html = renderToString(<RangeCalendar months={2} min={d(2026, 8, 3)} max={d(2026, 8, 20)} locale="en-US" />);
    expect(html).toMatch(/<h2[^>]*>September 2026<\/h2>/);
  });
});

describe('months={2}: the fourth review of #138', () => {
  let pending: ((w: number) => void)[] = [];
  class LaterRO {
    constructor(private cb: ResizeObserverCallback) {}
    observe(el: Element) { if (el.classList.contains('sg-rangecalendar')) pending.push((w) => this.cb([{ contentRect: { width: w } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)); }
    unobserve() {} disconnect() {}
  }
  const report = (w: number) => act(() => { for (const f of pending) f(w); });
  const frame = () => act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
  beforeEach(() => { pending = []; globalThis.ResizeObserver = LaterRO as unknown as typeof ResizeObserver; });
  afterEach(() => { vi.useRealTimers(); });

  it('autoFocus takes the focus from the button that opened the calendar (it still has it)', () => {
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    try {
      render(<Calendar autoFocus aria-label="c" defaultMonth={d(2026, 10, 1)} value={d(2026, 10, 12)} locale="en-US" />);
      expect(focusedDate()).toBe('2026-11-12');
    } finally { opener.remove(); }
  });

  it('autoFocus gives up when the focus went elsewhere while it waited, even if it came back to the page', () => {
    render(<><RangeCalendar months={2} autoFocus aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" /><input aria-label="other" /></>);
    const other = screen.getByRole('textbox', { name: 'other' });
    act(() => other.focus()); act(() => other.blur());   /* then a press on blank page: the body has it */
    report(1280);
    expect(document.activeElement).toBe(document.body);
  });

  it('bounds in one month: the focused day is today when today is within them', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 12, 12));
    render(<RangeCalendar months={2} autoFocus aria-label="s" min={d(2026, 8, 3)} max={d(2026, 8, 20)} locale="en-US" />);
    expect(focusedDate()).toBe('2026-09-12');
  });

  it('recovery cut short by another change of count still gives the focus back', async () => {
    const { container } = render(<RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" />);
    report(1280);
    act(() => dayIn(container, '2026-12-15').focus());
    report(400);    /* the day's grid goes: recovery is queued */
    report(1280);   /* and the count changes again before its frame */
    await frame();
    expect(focusedDate()).toBe('2026-12-15');
  });

  it('a focus outside the calendar before the frame cancels the recovery, even if it is lost again at once', async () => {
    const { container } = render(<><RangeCalendar months={2} aria-label="s" defaultMonth={d(2026, 10, 1)} locale="en-US" /><input aria-label="other" /></>);
    report(1280);
    act(() => dayIn(container, '2026-12-15').focus());
    report(400);
    const other = screen.getByRole('textbox', { name: 'other' });
    act(() => { other.focus(); other.blur(); });
    await frame();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('months={2}: the fifth review of #138', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('a plain Calendar showing 1 January 2000 keeps that day as its tab stop (no sentinel date)', () => {
    const { container } = render(<Calendar aria-label="c" defaultMonth={d(2000, 0, 1)} locale="en-US" />);
    expect([...container.querySelectorAll('.sg-day[tabindex="0"]')].map((b) => b.getAttribute('data-date'))).toEqual(['2000-01-01']);
  });

  it('server-rendered with same-month bounds: autoFocus waits for today and takes it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 12, 12));
    const ui = <RangeCalendar months={2} autoFocus aria-label="s" min={d(2026, 8, 3)} max={d(2026, 8, 20)} locale="en-US" />;
    const host = document.createElement('div'); document.body.append(host);
    host.innerHTML = renderToString(ui);
    try {
      await act(async () => { hydrateRoot(host, ui); });
      expect(focusedDate()).toBe('2026-09-12');
    } finally { host.remove(); }
  });
});
