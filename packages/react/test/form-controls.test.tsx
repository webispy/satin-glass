/* Regression tests for form-control fixes: disabled pickers that submitted, Slider's range and stale closures,
   Stepper's extra step after a hold, Combobox reconciling its text and active option, DateRangePicker's late close,
   the empty year grid, Select's Tab and Space, wheel type-ahead, a kept indeterminate, the double dim, Banner's
   double dismiss, FilterBar's focus after clearing, compact Pagination's current page, and useBridge set-ups. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import * as core from '@satin-glass/core';
import {
  Select, DatePicker, DateRangePicker, TimePicker, Combobox, Slider, Stepper, Calendar, Wheel, Checkbox, Banner, FilterBar,
  Pagination, TabBar, Tab, Tabs, Button, ThemeProvider, createTheme,
} from '../src';

vi.mock('@satin-glass/core', async (orig) => {
  const actual = await orig<typeof import('@satin-glass/core')>();
  return { ...actual, createBridge: vi.fn(actual.createBridge), createOverflowStrip: vi.fn(actual.createOverflowStrip) };
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const fruit = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }, { value: 'c', label: 'Cherry' }];

describe('disabled pickers submit nothing', () => {
  it('Select, DatePicker, DateRangePicker and TimePicker leave the form data, as Combobox does', () => {
    const d = new Date(2026, 0, 5), r = { start: new Date(2026, 0, 5), end: new Date(2026, 0, 8) };
    const fields = (disabled: boolean) => (
      <form data-testid={disabled ? 'off' : 'on'}>
        <Select aria-label="s" name="s" options={fruit} defaultValue="a" disabled={disabled} />
        <DatePicker aria-label="d" name="d" defaultValue={d} disabled={disabled} />
        <DateRangePicker aria-label="r" name="r" defaultValue={r} disabled={disabled} />
        <TimePicker aria-label="t" name="t" defaultValue="09:30" disabled={disabled} />
        <Combobox aria-label="c" name="c" options={fruit} defaultValue="a" disabled={disabled} />
      </form>
    );
    render(<>{fields(false)}{fields(true)}</>);
    const on = new FormData(screen.getByTestId('on') as HTMLFormElement), off = new FormData(screen.getByTestId('off') as HTMLFormElement);
    expect([...on.keys()].sort()).toEqual(['c', 'd', 'r', 's', 't']);
    expect([...off.keys()]).toEqual([]);
  });
});

describe('Slider', () => {
  it('starts at min when min > 0, and shows a given value within the range', () => {
    const { rerender } = render(<Slider aria-label="x" min={10} max={20} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('10');
    rerender(<Slider aria-label="x" min={10} max={20} value={50} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('20');
  });
  it('starts at min when min < 0 (the default is min, not 0 clamped into the range)', () => {
    render(<Slider aria-label="x" min={-10} max={20} />);
    const s = screen.getByRole('slider');
    expect(s.getAttribute('aria-valuenow')).toBe('-10');
    expect(s.closest('.sg-slider')!.querySelector('.sg-slider__bubble')!.textContent).toBe('-10');
  });
  it('places the thumb by the current range when resized after min / max change', () => {
    const seen: ResizeObserverCallback[] = [];
    const RO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class { constructor(cb: ResizeObserverCallback) { seen.push(cb); } observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    try {
      const { rerender } = render(<Slider aria-label="x" value={50} min={0} max={100} />);
      const s = screen.getByRole('slider');
      rerender(<Slider aria-label="x" value={50} min={50} max={150} />);
      Object.defineProperty(s, 'clientWidth', { value: 200, configurable: true });
      act(() => seen.forEach((cb) => cb([], {} as ResizeObserver)));
      expect(s.style.getPropertyValue('--_pos')).toBe('0.00px');   /* 50 on 50..150 is the start (100px before) */
    } finally { globalThis.ResizeObserver = RO; }
  });
  it('calls the latest onChangeEnd after a drag', () => {
    const first = vi.fn(), latest = vi.fn();
    const { rerender } = render(<Slider aria-label="x" defaultValue={30} onChangeEnd={first} />);
    rerender(<Slider aria-label="x" defaultValue={30} onChangeEnd={latest} />);
    const s = screen.getByRole('slider');
    fireEvent.pointerDown(s, { pointerId: 1, button: 0, clientX: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, pointerType: 'mouse' });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });
});

describe('Stepper', () => {
  it('press and hold ends where the release is; a tap and a keyboard click step once', () => {
    vi.useFakeTimers();
    render(<Stepper label="n" defaultValue={0} />);
    const plus = screen.getByRole('button', { name: 'Increase n' });
    const value = () => document.querySelector('.sg-stepper__value > [data-roll], .sg-stepper__value > span:last-child')!.textContent;
    fireEvent.pointerDown(plus);
    act(() => { vi.advanceTimersByTime(400 + 80 * 3); });
    expect(value()).toBe('3');
    fireEvent.pointerUp(plus); fireEvent.click(plus, { detail: 1 });
    expect(value()).toBe('3');
    fireEvent.pointerDown(plus); fireEvent.pointerUp(plus); fireEvent.click(plus, { detail: 1 });
    expect(value()).toBe('4');
    fireEvent.click(plus, { detail: 0 });
    expect(value()).toBe('5');
  });
});

describe('Combobox', () => {
  const open = () => { const i = screen.getByRole('combobox'); fireEvent.click(i); return i as HTMLInputElement; };
  it('a choice the controlled parent refuses puts back the value’s text, so field and form agree', async () => {
    render(<form data-testid="f"><Combobox aria-label="c" name="c" options={fruit} value="a" onChange={() => {}} /></form>);
    const input = open();
    fireEvent.click(await screen.findByRole('option', { name: 'Banana' }));
    await waitFor(() => expect(input.value).toBe('Apple'));
    expect(new FormData(screen.getByTestId('f') as HTMLFormElement).get('c')).toBe('a');
  });
  it('reports a choice and a clear once, with no extra restore', async () => {
    const text = vi.fn();
    render(<Combobox aria-label="c" options={fruit} onInputChange={text} />);
    open();
    fireEvent.click(await screen.findByRole('option', { name: 'Banana' }));
    await waitFor(() => expect(text).toHaveBeenCalledWith('Banana', 'select'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await act(async () => {});
    expect(text.mock.calls).toEqual([['Banana', 'select'], ['', 'clear']]);
  });
  it('new results of the same length keep the active option by value, or start again from the first', async () => {
    const pick = vi.fn();
    const ui = (options: typeof fruit) => <Combobox aria-label="c" filter="none" options={options} onChange={pick} />;
    const { rerender } = render(ui([fruit[0], fruit[1]]));
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'x' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });   /* Banana */
    rerender(ui([fruit[1], fruit[2]]));
    await waitFor(() => expect(document.getElementById(input.getAttribute('aria-activedescendant')!)!.textContent).toContain('Banana'));
    rerender(ui([fruit[2], fruit[0]]));
    await waitFor(() => expect(document.getElementById(input.getAttribute('aria-activedescendant')!)!.textContent).toContain('Cherry'));
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pick).toHaveBeenCalledWith('c');
  });
  it('results that grow keep the active option by value', async () => {
    const pick = vi.fn();
    const ui = (options: typeof fruit) => <Combobox aria-label="c" filter="none" options={options} onChange={pick} />;
    const { rerender } = render(ui([fruit[0], fruit[1]]));
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'x' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });   /* Banana */
    rerender(ui(fruit));   /* Cherry appended */
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pick).toHaveBeenCalledWith('b');
  });
  it('multiple: a chosen option missing from the results that follow makes the first enabled one active', async () => {
    const pick = vi.fn();
    /* results that depend on the text: "c" finds Cherry; the empty text lists a disabled Durian, then Apple */
    function Search() {
      const [t, setT] = useState('');
      const options = t ? [fruit[2]] : [{ value: 'd', label: 'Durian', disabled: true }, fruit[0]];
      return <Combobox aria-label="c" multiple filter="none" options={options} onInputChange={(x) => setT(x)} onChange={pick} />;
    }
    render(<Search />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'c' } });
    await screen.findByRole('option', { name: 'Cherry' });
    fireEvent.keyDown(input, { key: 'Enter' });   /* Cherry, at 0; the text clears and Cherry leaves the list */
    await screen.findByRole('option', { name: 'Apple' });
    await act(async () => {});
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)!.textContent).toContain('Apple');
  });
  it('opened from the keyboard, new results without the active option make the first one active', async () => {
    const pick = vi.fn();
    const ui = (options: typeof fruit) => <Combobox aria-label="c" filter="none" options={options} onChange={pick} />;
    const { rerender } = render(ui([fruit[0], fruit[1]]));
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });   /* opens on Apple */
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });   /* Banana */
    rerender(ui([fruit[0], fruit[2]]));
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pick).toHaveBeenCalledWith('a');
  });
  it('a controlled value shows its label once the option arrives', async () => {
    const text = vi.fn();
    const { rerender } = render(<Combobox aria-label="c" options={[]} value="b" onInputChange={text} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.value).toBe('b');
    rerender(<Combobox aria-label="c" options={fruit} value="b" onInputChange={text} />);
    await waitFor(() => expect(input.value).toBe('Banana'));
    expect(text).toHaveBeenCalledTimes(1);
  });
});

describe('DateRangePicker', () => {
  it('a reopening right after a finished range is not closed by its timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(<DateRangePicker aria-label="r" defaultMonth={new Date(2026, 0, 1)} />);
    const trigger = screen.getByRole('button', { name: 'r' });
    fireEvent.click(trigger);
    const day = (iso: string) => document.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;
    await vi.waitFor(() => expect(day('2026-01-05')).toBeTruthy());
    fireEvent.click(day('2026-01-05')); fireEvent.click(day('2026-01-08'));
    fireEvent.click(trigger); fireEvent.click(trigger);   /* closed and opened again within the delay */
    act(() => { vi.advanceTimersByTime(1000); });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Calendar year grid', () => {
  it('Enter on an empty year list (min after max) does nothing', () => {
    const pick = vi.fn();
    render(<Calendar aria-label="c" openTo="year" min={new Date(2030, 0, 1)} max={new Date(2020, 0, 1)} onChange={pick} />);
    const list = screen.getAllByRole('listbox').find((l) => l.classList.contains('sg-calendar__cells--scroll'))!;
    /* an error in a React handler is reported to the window, not thrown to the caller */
    const errors: unknown[] = [], onError = (e: ErrorEvent) => { errors.push(e.error); e.preventDefault(); };
    window.addEventListener('error', onError);
    try { fireEvent.keyDown(list, { key: 'Enter' }); } finally { window.removeEventListener('error', onError); }
    expect(errors).toEqual([]);
    expect(pick).not.toHaveBeenCalled();
  });
});

describe('Select', () => {
  it('Tab closes the list even with nothing to choose', async () => {
    render(<Select aria-label="s" options={[{ value: 'x', label: 'X', disabled: true }]} />);
    const cb = screen.getByRole('combobox');
    fireEvent.click(cb);
    await screen.findByRole('listbox');
    fireEvent.keyDown(cb, { key: 'Tab' });
    expect(cb.getAttribute('aria-expanded')).toBe('false');
  });
  it('Space during a type-ahead search is part of it ("new y")', async () => {
    const pick = vi.fn();
    const states = [{ value: 'nj', label: 'New Jersey' }, { value: 'ny', label: 'New York' }, { value: 'nv', label: 'Nevada' }];
    render(<Select aria-label="s" options={states} onChange={pick} />);
    const cb = screen.getByRole('combobox');
    cb.focus();
    for (const key of ['n', 'e', 'w', ' ', 'y']) fireEvent.keyDown(cb, { key });
    expect(pick).not.toHaveBeenCalled();
    expect(document.getElementById(cb.getAttribute('aria-activedescendant')!)!.textContent).toContain('New York');
    fireEvent.keyDown(cb, { key: 'Enter' });
    expect(pick).toHaveBeenCalledWith('ny');
  });
});

describe('Select type-ahead', () => {
  const activeText = (cb: HTMLElement) => document.getElementById(cb.getAttribute('aria-activedescendant')!)!.textContent;
  it('a search ends with the list: a letter after closing and reopening starts a new one', async () => {
    /* a stale "n" + "y" would find Nyala; "y" alone finds Yukon */
    render(<Select aria-label="s" options={[{ value: 'nv', label: 'Nevada' }, { value: 'na', label: 'Nyala' }, { value: 'yk', label: 'Yukon' }]} />);
    const cb = screen.getByRole('combobox');
    cb.focus();
    fireEvent.keyDown(cb, { key: 'n' });
    await screen.findByRole('listbox');
    fireEvent.keyDown(cb, { key: 'Escape' });
    await waitFor(() => expect(cb.getAttribute('aria-expanded')).toBe('false'));
    fireEvent.keyDown(cb, { key: 'ArrowDown' });
    await screen.findByRole('listbox');
    fireEvent.keyDown(cb, { key: 'y' });
    expect(activeText(cb)).toContain('Yukon');
  });
  it('closed, a search that found nothing is not kept: "z" then "n" finds New York', async () => {
    render(<Select aria-label="s" options={[{ value: 'ny', label: 'New York' }]} />);
    const cb = screen.getByRole('combobox');
    cb.focus();
    fireEvent.keyDown(cb, { key: 'z' });
    expect(cb.getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(cb, { key: 'n' });
    await screen.findByRole('listbox');
    expect(activeText(cb)).toContain('New York');
  });
});

describe('Wheel type-ahead', () => {
  /* a compatibility guard, not a regression test: the literal match already won before the leading-zero reading */
  it('a row as written wins over the leading-zero reading', () => {
    const pick = vi.fn();
    render(<Wheel aria-label="w" options={[{ value: 1, label: '07' }, { value: 2, label: '70' }]} defaultValue={1} onChange={pick} />);
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: '7' });
    expect(pick).toHaveBeenCalledWith(2);
  });
  it('finds a row written with a leading zero by the number alone', () => {
    const pick = vi.fn();
    const hours = Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') }));
    render(<Wheel aria-label="h" options={hours} defaultValue={9} onChange={pick} />);
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: '7' });
    expect(pick).toHaveBeenCalledWith(7);
  });
});

describe('Checkbox', () => {
  it('stays indeterminate after a click while the app keeps it so', () => {
    render(<Checkbox label="all" checked={false} indeterminate onChange={() => {}} />);
    const c = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(c);
    expect(c.indeterminate).toBe(true);
  });
});

describe('disabled pickers are dimmed once', () => {
  it('the field dims; the trigger and the toggle inside it do not dim again', async () => {
    const { readFileSync } = await vi.importActual<{ readFileSync: (path: string, encoding: string) => string }>('node:fs');
    /* vite serves the file under /@fs */
    const css = readFileSync(new URL('../../core/styles/selection.css', import.meta.url).pathname.replace(/^\/@fs/, ''), 'utf8');
    expect(css).toMatch(/\.sg-field\[data-disabled="true"\] \.sg-select:disabled \{ opacity: 1; \}/);
    expect(css).not.toMatch(/\.sg-combobox__toggle:disabled \{[^}]*opacity/);
    /* …and every disabled picker sits in a field marked disabled, so the field's own dim applies */
    render(<>
      <Select aria-label="s" options={fruit} disabled />
      <DatePicker aria-label="d" disabled />
      <DateRangePicker aria-label="r" disabled />
      <TimePicker aria-label="t" disabled />
      <Combobox aria-label="c" options={fruit} disabled />
    </>);
    for (const name of ['s', 'd', 'r', 't', 'c']) {
      const el = screen.getAllByLabelText(name).find((x) => x.matches('button, input'))!;
      expect(el.closest('.sg-field')?.getAttribute('data-disabled')).toBe('true');
    }
  });
});

describe('Banner', () => {
  it('a double click dismisses once', async () => {
    const gone = vi.fn();
    render(<Banner title="t" onDismiss={gone} />);
    const x = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(x); fireEvent.click(x);
    await vi.waitFor(() => expect(gone).toHaveBeenCalled());
    await act(async () => {});
    expect(gone).toHaveBeenCalledTimes(1);
  });
});

describe('FilterBar', () => {
  it('clearing focuses the first control that can take focus, after the clear has rendered', async () => {
    function Bar() {
      const [list, setList] = useState(['a', 'b']);
      return (
        <FilterBar aria-label="f" count={list.length} onClear={() => setList([])}>
          {/* gone once cleared: focusing before the update would land here and fall to the page */}
          {list.length > 0 && <button type="button">only while filtered</button>}
          <button type="button" disabled>off</button>
          {/* hidden by the layout: a browser does not focus it */}
          <button type="button" ref={(el) => { if (el) el.focus = () => {}; }}>hidden at this width</button>
          <Combobox aria-label="fruit" multiple options={fruit} value={list} onChange={setList} />
        </FilterBar>
      );
    }
    render(<Bar />);
    fireEvent.click(document.querySelector<HTMLElement>('.sg-filterbar__applied button')!);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'fruit' })));
  });
  it('a link left as the only control takes focus', async () => {
    function Bar() {
      const [on, setOn] = useState(true);
      return (
        <FilterBar aria-label="f" count={on ? 1 : 0} onClear={() => setOn(false)}>
          {on && <button type="button">only while filtered</button>}
          <Button href="#saved">Saved filters</Button>
        </FilterBar>
      );
    }
    render(<Bar />);
    fireEvent.click(document.querySelector<HTMLElement>('.sg-filterbar__applied button')!);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Saved filters' })));
  });
});

describe('Pagination compact', () => {
  it('says the current page and count where the page list is hidden, in English and Korean', () => {
    const { rerender } = render(<Pagination page={3} pageCount={20} onChange={() => {}} />);
    const said = () => document.querySelector('.sg-pagination__compact .sg-visually-hidden')!;
    expect(said().textContent).toBe('Page 3 of 20');
    expect(said().closest('[aria-hidden="true"]')).toBeNull();
    expect(document.querySelector('.sg-pagination__compact [aria-hidden="true"]')!.textContent).toBe('3 / 20');
    rerender(<ThemeProvider theme={createTheme({ locale: 'ko-KR' })}><Pagination page={3} pageCount={20} onChange={() => {}} /></ThemeProvider>);
    expect(said().textContent).toBe('20개 중 3번째 페이지');
  });
  it('says the app’s own page label there when `labels.page` is set', () => {
    render(<Pagination page={3} pageCount={20} onChange={() => {}} labels={{ page: (n) => `Seite ${n}` }} />);
    expect(document.querySelector('.sg-pagination__compact .sg-visually-hidden')!.textContent).toBe('Seite 3 / 20');
  });
});

describe('useBridge', () => {
  const made = vi.mocked(core.createBridge);
  it('sets up again when TabBar becomes draggable', () => {
    made.mockClear();
    const { rerender } = render(<TabBar aria-label="t"><Tab value="a" label="A" /><Tab value="b" label="B" /></TabBar>);
    expect(made.mock.calls.at(-1)![2].draggable).toBe(false);
    rerender(<TabBar aria-label="t" draggable><Tab value="a" label="A" /><Tab value="b" label="B" /></TabBar>);
    expect(made.mock.calls.at(-1)![2].draggable).toBe(true);
  });
  it('a change of draggable alone keeps the strip, and so where the user scrolled it', () => {
    const strips = vi.mocked(core.createOverflowStrip);
    strips.mockClear();
    const tabs = (draggable: boolean) => <TabBar aria-label="t" draggable={draggable}><Tab value="a" label="A" /><Tab value="b" label="B" /></TabBar>;
    const { rerender } = render(tabs(false));
    rerender(tabs(true));
    expect(strips).toHaveBeenCalledTimes(1);
  });
  it('an edge-fade entry queued before the strip was set aside does not mark the list again', () => {
    const seen: { cb: IntersectionObserverCallback; targets: Element[] }[] = [];
    const IO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      targets: Element[] = [];
      constructor(cb: IntersectionObserverCallback) { seen.push({ cb, targets: this.targets }); }
      observe(t: Element) { this.targets.push(t); } unobserve() {} disconnect() {} takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
    try {
      const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
      const { rerender } = render(<Tabs aria-label="t" items={items} />);
      const list = screen.getByRole('tablist'), io = seen.at(-1)!;
      rerender(<Tabs aria-label="t" variant="pill" items={items} />);
      act(() => io.cb(io.targets.map((target) => ({ target, intersectionRatio: 0.5 }) as unknown as IntersectionObserverEntry), {} as IntersectionObserver));
      expect(list.hasAttribute('data-sg-more-start') || list.hasAttribute('data-sg-more-end')).toBe(false);
    } finally { globalThis.IntersectionObserver = IO; }
  });
  it('Tabs switched from pills to the underline gain the drop', () => {
    made.mockClear();
    const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    const { rerender } = render(<Tabs aria-label="t" variant="pill" items={items} />);
    expect(made).not.toHaveBeenCalled();
    rerender(<Tabs aria-label="t" items={items} />);
    expect(made).toHaveBeenCalledTimes(1);
    expect(made.mock.calls[0][1]).toBe(document.querySelector('.sg-tabs__indicator'));
  });
  it('a strip set aside takes its edge fades with it (Tabs switched to pills)', () => {
    const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    const { rerender } = render(<Tabs aria-label="t" items={items} />);
    const list = screen.getByRole('tablist');
    list.setAttribute('data-sg-more-end', '');   /* as the strip marks an overflowing list */
    rerender(<Tabs aria-label="t" variant="pill" items={items} />);
    expect(list.hasAttribute('data-sg-more-end')).toBe(false);
  });
  it('turning dragging off mid-drag leaves no press, drag or hover behind', () => {
    const tabs = (draggable: boolean) => <TabBar aria-label="t" draggable={draggable}><Tab value="a" label="A" /><Tab value="b" label="B" /></TabBar>;
    const { rerender } = render(tabs(true));
    const track = screen.getByRole('tablist'), [a] = screen.getAllByRole('tab');
    fireEvent.pointerDown(a, { pointerId: 1, button: 0, clientX: 10, pointerType: 'mouse' });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 40, pointerType: 'mouse' });
    expect(track.hasAttribute('data-sg-pressing')).toBe(true);
    rerender(tabs(false));
    expect(track.hasAttribute('data-sg-pressing') || track.hasAttribute('data-sg-dragging')).toBe(false);
    expect(track.querySelector('[data-hover]')).toBeNull();
  });
});
