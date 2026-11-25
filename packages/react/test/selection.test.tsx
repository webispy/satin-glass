import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { Checkbox, RadioGroup, Radio, ChoiceList, Select, Calendar, DatePicker, Combobox, ColumnChooser, type Column } from '../src';

describe('Checkbox', () => {
  it('is a real checkbox with a label; toggles and reports', () => {
    const on = vi.fn();
    render(<Checkbox label="동의" onChange={on} />);
    const c = screen.getByRole('checkbox', { name: '동의' }) as HTMLInputElement;
    fireEvent.click(c);
    expect(c.checked).toBe(true); expect(on).toHaveBeenCalledWith(true);
  });
  it('sets the indeterminate DOM property', () => {
    render(<Checkbox label="모두" indeterminate />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true);
  });
  it('links its description', () => {
    render(<Checkbox label="약관" description="자세한 내용" />);
    const c = screen.getByRole('checkbox');
    expect(document.getElementById(c.getAttribute('aria-describedby')!)!.textContent).toBe('자세한 내용');
  });
});

describe('RadioGroup', () => {
  it('shares one name, reflects the value and changes on click; disabled radios are disabled', () => {
    const on = vi.fn();
    render(<RadioGroup label="수단" defaultValue="a" onChange={on}><Radio value="a" label="A" /><Radio value="b" label="B" /><Radio value="c" label="C" disabled /></RadioGroup>);
    const [a, b, c] = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(a.name).toBe(b.name); expect(a.checked).toBe(true);
    fireEvent.click(b); expect(b.checked).toBe(true); expect(on).toHaveBeenCalledWith('b');
    expect(c.disabled).toBe(true);
    expect(screen.getByRole('group', { name: '수단' })).toBeTruthy();
  });
});

describe('ChoiceList', () => {
  it('single: a radiogroup with roving tab stop; arrows move and select, skipping disabled', () => {
    render(<ChoiceList aria-label="모드" defaultValue="a" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }]} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[0].focus();
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' });
    expect(radios[2].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radios[2]);
  });
  it('multiple: checkboxes that toggle independently', () => {
    const on = vi.fn();
    render(<ChoiceList multiple aria-label="알림" defaultValue={['a']} onChange={on} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />);
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[1]);
    expect(on).toHaveBeenLastCalledWith(['a', 'b']);
    fireEvent.click(boxes[0]);
    expect(on).toHaveBeenLastCalledWith(['b']);
  });
});

describe('Select', () => {
  const opts = [{ value: 'apple', label: 'Apple' }, { value: 'banana', label: 'Banana', disabled: true }, { value: 'cherry', label: 'Cherry' }, { value: 'cocoa', label: 'Cocoa' }];
  it('is a combobox that opens a listbox with ↓, moves with arrows (skipping disabled) and chooses with Enter', async () => {
    const on = vi.fn();
    render(<Select aria-label="과일" options={opts} onChange={on} />);
    const cb = screen.getByRole('combobox', { name: '과일' });
    expect(cb.getAttribute('aria-expanded')).toBe('false');
    cb.focus();
    fireEvent.keyDown(cb, { key: 'ArrowDown' });
    const lb = await screen.findByRole('listbox');
    expect(cb.getAttribute('aria-expanded')).toBe('true');
    expect(cb.getAttribute('aria-controls')).toBe(lb.id);
    expect(document.getElementById(cb.getAttribute('aria-activedescendant')!)!.textContent).toContain('Apple');
    fireEvent.keyDown(cb, { key: 'ArrowDown' });
    expect(document.getElementById(cb.getAttribute('aria-activedescendant')!)!.textContent).toContain('Cherry');
    fireEvent.keyDown(cb, { key: 'Enter' });
    expect(on).toHaveBeenCalledWith('cherry');
    expect(cb.textContent).toContain('Cherry');
    expect(document.activeElement).toBe(cb);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });
  it('describes itself only by help text it shows (the filter pill shows none)', () => {
    const { rerender } = render(<Select label="과일" options={opts} helperText="하나만" error="골라 주세요" />);
    const field = screen.getByRole('combobox', { name: /과일/ });
    expect(document.getElementById(field.getAttribute('aria-describedby')!)!.textContent).toBe('골라 주세요');
    rerender(<Select variant="filter" label="과일" options={opts} helperText="하나만" error="골라 주세요" />);
    const pill = screen.getByRole('combobox', { name: /과일/ });
    expect(pill.hasAttribute('aria-describedby')).toBe(false);
    expect(pill.getAttribute('aria-invalid')).toBe('true');
  });
  it('type-to-select: typing opens at the match; repeating a letter cycles', async () => {
    render(<Select aria-label="과일" options={opts} />);
    const cb = screen.getByRole('combobox');
    fireEvent.keyDown(cb, { key: 'c' });
    await screen.findByRole('listbox');
    expect(document.getElementById(cb.getAttribute('aria-activedescendant')!)!.textContent).toContain('Cherry');
    fireEvent.keyDown(cb, { key: 'c' });
    expect(document.getElementById(cb.getAttribute('aria-activedescendant')!)!.textContent).toContain('Cocoa');
  });
  it('Escape closes without changing; a click on an option chooses; the hidden input submits the value', async () => {
    const { container } = render(<Select aria-label="과일" options={opts} defaultValue="apple" name="fruit" />);
    const cb = screen.getByRole('combobox');
    fireEvent.click(cb);
    await screen.findByRole('listbox');
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(cb.textContent).toContain('Apple');
    fireEvent.click(cb);
    fireEvent.click(await screen.findByRole('option', { name: 'Cocoa' }));
    expect((container.querySelector('input[name=fruit]') as HTMLInputElement).value).toBe('cocoa');
  });
  it('a disabled option cannot be chosen by click', async () => {
    const on = vi.fn();
    render(<Select aria-label="과일" options={opts} onChange={on} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Banana' }));
    expect(on).not.toHaveBeenCalled();
  });
});

describe('Calendar', () => {
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);
  it('arrows move a day / a week, PageDown a month, Enter chooses', () => {
    const on = vi.fn();
    render(<Calendar defaultValue={d(2026, 1, 31)} onChange={on} locale="en-US" aria-label="cal" />);
    const grid = screen.getByRole('grid');
    const focused = () => grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')!.dataset.date;
    expect(focused()).toBe('2026-01-31');
    fireEvent.keyDown(grid, { key: 'ArrowRight' }); expect(focused()).toBe('2026-02-01');
    fireEvent.keyDown(grid, { key: 'ArrowUp' }); expect(focused()).toBe('2026-01-25');
    fireEvent.keyDown(grid, { key: 'PageDown' }); expect(focused()).toBe('2026-02-25');
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(on).toHaveBeenCalledWith(d(2026, 2, 25));
    expect(screen.getByRole('heading').textContent).toContain('February');
  });
  it('clamps the day when a month is shorter (Jan 31 + 1 month → Feb 28)', () => {
    render(<Calendar defaultValue={d(2026, 1, 31)} locale="en-US" />);
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'PageDown' });
    expect(grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')!.dataset.date).toBe('2026-02-28');
  });
  it('keyboard movement stays inside min / max', () => {
    render(<Calendar defaultValue={d(2026, 3, 18)} min={d(2026, 3, 5)} max={d(2026, 3, 20)} locale="en-US" />);
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')!.dataset.date).toBe('2026-03-20');
    fireEvent.keyDown(grid, { key: 'PageUp' });
    expect(grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')!.dataset.date).toBe('2026-03-05');
  });
  it('a key pressed against min leaves focus where it goes next', async () => {
    render(<Calendar defaultValue={d(2026, 3, 5)} min={d(2026, 3, 5)} locale="en-US" />);
    const grid = screen.getByRole('grid');
    grid.querySelector<HTMLButtonElement>('[data-date="2026-03-05"]')!.focus();
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    await act(async () => { await new Promise<void>((r) => requestAnimationFrame(() => r())); });
    expect(document.activeElement).toBe(grid.querySelector('[data-date="2026-03-05"]'));
    /* the press changed nothing; the next month's button keeps focus when it is used */
    const next = screen.getByRole('button', { name: 'Next month' });
    next.focus();
    fireEvent.click(next);
    /* after the frame a refocus would be queued in */
    await act(async () => { await new Promise<void>((r) => requestAnimationFrame(() => r())); });
    expect(screen.getByRole('heading').textContent).toBe('April 2026');
    expect(document.activeElement).toBe(next);
  });
  it('min / max / isDateDisabled disable days and they cannot be chosen', () => {
    const on = vi.fn();
    render(<Calendar defaultValue={d(2026, 3, 10)} min={d(2026, 3, 5)} max={d(2026, 3, 20)} isDateDisabled={(x) => x.getDate() === 12} onChange={on} locale="en-US" />);
    const btn = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)!;
    expect(btn('2026-03-04').getAttribute('aria-disabled')).toBe('true');
    expect(btn('2026-03-21').getAttribute('aria-disabled')).toBe('true');
    expect(btn('2026-03-12').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btn('2026-03-12')); expect(on).not.toHaveBeenCalled();
    fireEvent.click(btn('2026-03-11')); expect(on).toHaveBeenCalledWith(d(2026, 3, 11));
  });
  it('marks today and the selection for assistive technology', () => {
    const today = new Date();
    render(<Calendar defaultValue={today} locale="en-US" />);
    const cur = document.querySelector('[aria-current="date"]')!;
    expect(cur.getAttribute('aria-pressed')).toBe('true');
    expect(cur.closest('td')!.getAttribute('aria-selected')).toBe('true');
  });
});

describe('DatePicker', () => {
  it('opens a calendar dialog; choosing a day closes it and writes the date', async () => {
    function T() { const [v, setV] = useState<Date | null>(null); return <DatePicker label="방문일" value={v} onChange={setV} locale="en-US" format={(x) => `${x.getMonth() + 1}/${x.getDate()}`} name="visit" />; }
    const { container } = render(<T />);
    const trigger = screen.getByRole('button', { name: /방문일/ });
    fireEvent.click(trigger);
    const dlg = await screen.findByRole('dialog');
    const target = dlg.querySelector<HTMLButtonElement>('.sg-day:not([data-outside]):not([aria-disabled="true"])')!;
    fireEvent.click(target);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const iso = target.dataset.date!;
    const [, m, dd] = iso.split('-').map(Number);
    expect(trigger.textContent).toContain(`${m}/${dd}`);
    expect((container.querySelector('input[name=visit]') as HTMLInputElement).value).toBe(iso);
  });
});

describe('Combobox multiple', () => {
  const opts = [{ value: 'a', label: 'Aurora' }, { value: 'b', label: 'Borealis' }, { value: 'c', label: 'Cirrus' }];
  function M() { const [v, setV] = useState<string[]>(['a']); return <><Combobox multiple label="공급사" options={opts} value={v} onChange={setV} name="vendor" /><output>{v.join(',')}</output></>; }
  it('chips, toggling keeps the list open and clears the search, Backspace removes the last, a multi-select listbox', () => {
    const { container } = render(<M />);
    const input = screen.getByRole('combobox', { name: '공급사' });
    expect(container.querySelector('.sg-combobox__chip')!.textContent).toBe('Aurora');
    fireEvent.change(input, { target: { value: 'cir' } });
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.querySelector('output')!.textContent).toBe('a,c');
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: /Cirrus/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: /Aurora/ }));
    expect(document.querySelector('output')!.textContent).toBe('c');
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(document.querySelector('output')!.textContent).toBe('');
    expect(container.querySelectorAll('input[name=vendor]')).toHaveLength(0);
  });
});

describe('Combobox maxChips', () => {
  it('more chosen than maxChips: a count stands in for the chips; the description still names them all', () => {
    const { container } = render(<Combobox multiple aria-label="공급사" maxChips={1} labels={{ count: (n) => `공급사 ${n}곳` }} defaultValue={['a', 'b', 'c']}
      options={[{ value: 'a', label: 'Aurora' }, { value: 'b', label: 'Borealis' }, { value: 'c', label: 'Cirrus' }]} />);
    expect(container.querySelectorAll('.sg-combobox__chip')).toHaveLength(0);
    expect(container.querySelector('.sg-combobox__count')!.textContent).toBe('공급사 3곳');
    const desc = screen.getByRole('combobox').getAttribute('aria-describedby')!;
    expect(document.getElementById(desc)!.textContent).toBe('Aurora, Borealis, Cirrus');
  });
});

describe('ColumnChooser', () => {
  type R = { id: string };
  const cols: Column<R>[] = [
    { key: 'name', header: '모델', sticky: true },
    { key: 'mmlu', header: 'MMLU', group: '지식' }, { key: 'gpqa', header: 'GPQA', group: '지식' },
    { key: 'cost', header: '비용' },
  ];
  function C() { const [h, setH] = useState<string[]>([]); return <><ColumnChooser columns={cols} hidden={h} onHiddenChange={setH} label="열" /><output>{h.join(',')}</output></>; }
  it('groups toggle whole, sticky columns are locked, the last shown cannot be hidden, show all', async () => {
    render(<C />);
    fireEvent.click(screen.getByRole('button', { name: '열' }));
    const box = (n: string) => screen.getByRole('checkbox', { name: n }) as HTMLInputElement;
    await waitFor(() => expect(box('모델')).toBeTruthy());
    expect(box('모델').disabled).toBe(true);
    fireEvent.click(box('지식'));
    expect(document.querySelector('output')!.textContent).toBe('mmlu,gpqa');
    fireEvent.click(box('MMLU'));
    expect(box('지식').indeterminate).toBe(true);
    fireEvent.click(box('비용'));
    expect(document.querySelector('output')!.textContent).toBe('gpqa,cost');
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(document.querySelector('output')!.textContent).toBe('');
  });
});
