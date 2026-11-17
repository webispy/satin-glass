import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { useState } from 'react';
import {
  Tabs, Tooltip, Banner, EmptyState, Pagination, pageWindow, Stat, Tag, Level, Accordion, DataTable, niceTicks,
  LineChart, BarChart, DonutChart, BarMeter, IntervalPlot, type Column,
} from '../src';

describe('Tabs', () => {
  const items = [{ value: 'a', label: 'A', content: 'Panel A' }, { value: 'b', label: 'B', content: 'Panel B', disabled: true }, { value: 'c', label: 'C', content: 'Panel C' }];
  it('tablist / tab / tabpanel wiring; arrow keys select and skip disabled; Home / End', () => {
    render(<Tabs aria-label="보기" items={items} />);
    const [a, , c] = screen.getAllByRole('tab');
    expect(a.getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(a.id);
    expect(a.getAttribute('aria-controls')).toBe(panel.id);
    a.focus(); fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(c.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel C');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Home' });
    expect(a.getAttribute('aria-selected')).toBe('true');
  });
  it('manual activation: arrows move focus only, Enter selects', () => {
    render(<Tabs aria-label="보기" activation="manual" items={items} />);
    const [a, , c] = screen.getAllByRole('tab');
    a.focus(); fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(c);
    expect(a.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Enter' });
    expect(c.getAttribute('aria-selected')).toBe('true');
  });
});

describe('Tooltip', () => {
  it('shows on keyboard focus, describes its trigger, hides on Escape', () => {
    render(<Tooltip content="설명"><button>정보</button></Tooltip>);
    const b = screen.getByRole('button');
    b.matches = ((sel: string) => sel === ':focus-visible' || Element.prototype.matches.call(b, sel)) as typeof b.matches;
    act(() => { b.focus(); });
    const tip = screen.getByRole('tooltip');
    expect(b.getAttribute('aria-describedby')).toContain(tip.id);
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Banner / EmptyState', () => {
  it('banner: live role by tone; dismiss calls back', async () => {
    const on = vi.fn();
    render(<Banner tone="danger" title="실패" live onDismiss={on} dismissLabel="닫기">본문</Banner>);
    expect(screen.getByRole('alert').textContent).toContain('실패');
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    await vi.waitFor(() => expect(on).toHaveBeenCalled());
  });
  it('empty state renders title, description and actions', () => {
    render(<EmptyState title="결과 없음" description="필터를 바꿔 보세요" actions={<button>초기화</button>} />);
    expect(screen.getByText('결과 없음')).toBeTruthy();
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
  });
});

describe('Pagination', () => {
  it('page window keeps a constant size and shows gaps', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 16, 17, 18, 19, 20]);
    for (let p = 1; p <= 20; p++) expect(pageWindow(p, 20)).toHaveLength(7);
  });
  it('current page is aria-current; prev disabled on the first page; clicks report', () => {
    const on = vi.fn();
    render(<Pagination page={1} pageCount={10} onChange={on} />);
    expect(screen.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe('page');
    expect((screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(on).toHaveBeenCalledWith(2);
  });
});

describe('Stat / Tag / Level', () => {
  it('says the direction in words; colour follows whether up is good', () => {
    const { container, rerender } = render(<Stat label="방문" value="1,204" delta="+12%" words={{ up: '증가', down: '감소' }} />);
    expect(container.textContent).toContain('증가');
    expect(container.querySelector('.gl-stat__delta')!.getAttribute('data-good')).toBe('good');
    rerender(<Stat label="오류" value="3" delta="+2%" invert />);
    expect(container.querySelector('.gl-stat__delta')!.getAttribute('data-good')).toBe('bad');
    rerender(<Stat label="비용" value="$1" delta="-4%" invert />);
    expect(container.querySelector('.gl-stat__delta')!.getAttribute('data-good')).toBe('good');
  });
  it('loading shows a skeleton and is aria-busy', () => {
    const { container } = render(<Stat label="방문" value="1" loading />);
    expect(container.firstElementChild!.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.gl-skeleton')).toBeTruthy();
  });
  it('tag tone and level bars', () => {
    const { container } = render(<><Tag tone="warning">1회 측정</Tag><Level value={2} /></>);
    expect(container.querySelector('.gl-tag')!.getAttribute('data-tone')).toBe('warning');
    expect(container.querySelectorAll('.gl-level rect[data-on]')).toHaveLength(2);
  });
});

describe('Accordion', () => {
  it('buttons control regions; single mode closes the other', () => {
    render(<Accordion multiple={false} items={[{ value: 'a', title: 'A', content: 'aa' }, { value: 'b', title: 'B', content: 'bb' }]} />);
    const [a, b] = screen.getAllByRole('button');
    fireEvent.click(a);
    expect(a.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(a.getAttribute('aria-controls')!)!.getAttribute('role')).toBe('region');
    fireEvent.click(b);
    expect(a.getAttribute('aria-expanded')).toBe('false');
    expect(b.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('charts', () => {
  it('nice ticks', () => {
    expect(niceTicks(0, 97, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(3, 4.2, 4)[0]).toBeLessThanOrEqual(3);
  });
  const data = [{ d: '월', a: 3, b: 5 }, { d: '화', a: 4, b: 2 }, { d: '수', a: 6, b: 7 }];
  const series = [{ key: 'a', label: '방문' }, { key: 'b', label: '가입' }];
  it('line chart: a labelled figure, a hidden data table, a legend that hides series (never the last)', () => {
    const { container } = render(<LineChart aria-label="방문 추이" data={data} x="d" series={series} />);
    const table = container.querySelector('table')!;
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    const keys = screen.getAllByRole('button');
    fireEvent.click(keys[0]);
    expect(keys[0].getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(keys[1]);
    expect(keys[1].getAttribute('aria-pressed')).toBe('true');
  });
  it('bar chart: arrow keys announce the category', () => {
    const { container } = render(<BarChart aria-label="채널" data={data} x="d" series={series} />);
    const plot = container.querySelector('.gl-chart__plot')!;
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    expect(container.querySelector('[aria-live]')!.textContent).toContain('월');
  });
  it('donut: percentages; marks', () => {
    const { container } = render(<><DonutChart aria-label="기기" data={[{ label: '모바일', value: 3 }, { label: 'PC', value: 1 }]} locale="en-US" /><BarMeter value={50} /><IntervalPlot value={80} low={75} high={85} /></>);
    expect(container.textContent).toContain('75%');
    expect((container.querySelector('.gl-barmeter__fill') as HTMLElement).style.transform).toMatch(/^scaleX\(0\.50*\)$/);
    expect((container.querySelector('.gl-interval__dot') as HTMLElement).style.left).toMatch(/^80(\.0+)?%$/);
  });
});

describe('DataTable', () => {
  type R = { id: string; name: string; score: number | null; cost: number };
  const rows: R[] = [{ id: '1', name: 'Beta', score: 80, cost: 2 }, { id: '2', name: 'alpha', score: null, cost: 1 }, { id: '3', name: 'Gamma', score: 95, cost: 3 }];
  const cols: Column<R>[] = [
    { key: 'name', header: '서버', sortable: true, sticky: true },
    { key: 'score', header: '점수', group: '일반', align: 'end', sortable: true, firstSort: 'desc', description: '처리율' },
    { key: 'cost', header: '비용', group: '비용', subheader: '1K 요청당', align: 'end', sortable: true },
  ];
  function T(p: Partial<React.ComponentProps<typeof DataTable<R>>>) { return <DataTable<R> aria-label="서버" rows={rows} columns={cols} rowKey={(r) => r.id} {...p} />; }
  const names = () => [...document.querySelectorAll('tbody:last-of-type tr')].map((tr) => tr.querySelector('th')?.textContent);
  it('a grid with column groups, aria-sort, sorting cycles (empties last in both directions)', () => {
    render(<T />);
    expect(screen.getByRole('grid', { name: '서버' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(expect.arrayContaining(['일반', '비용']));
    const score = screen.getByRole('button', { name: /점수/ });
    fireEvent.click(score);
    expect(names()).toEqual(['Gamma', 'Beta', 'alpha']);
    expect(score.closest('th')!.getAttribute('aria-sort')).toBe('descending');
    fireEvent.click(score);
    expect(names()).toEqual(['Beta', 'Gamma', 'alpha']);
    fireEvent.click(score);
    expect(names()).toEqual(['Beta', 'alpha', 'Gamma']);
    fireEvent.click(screen.getByRole('button', { name: /서버/ }));
    expect(names()).toEqual(['alpha', 'Beta', 'Gamma']);
  });
  it('manual sort only reports', () => {
    const on = vi.fn();
    render(<T manualSort onSortChange={on} />);
    fireEvent.click(screen.getByRole('button', { name: /점수/ }));
    expect(on).toHaveBeenCalledWith({ key: 'score', dir: 'desc' });
    expect(names()).toEqual(['Beta', 'alpha', 'Gamma']);
  });
  it('selection: header checkbox (indeterminate), shift-click range, Space on a row', () => {
    function S() { const [s, setS] = useState<string[]>([]); return <><T selectable selected={s} onSelectedChange={setS} /><output>{s.slice().sort().join(',')}</output></>; }
    render(<S />);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(boxes[1]);
    expect((boxes[0]).indeterminate).toBe(true);
    fireEvent.click(boxes[3], { shiftKey: true });
    expect(document.querySelector('output')!.textContent).toBe('1,2,3');
    fireEvent.click(boxes[0]);
    expect(document.querySelector('output')!.textContent).toBe('');
    const cell = document.querySelector<HTMLElement>('tbody:last-of-type tr th')!;
    cell.focus(); fireEvent.keyDown(cell, { key: ' ' });
    expect(document.querySelector('output')!.textContent).toBe('1');
  });
  it('keyboard: arrows move between cells; one tab stop', () => {
    render(<T />);
    const first = document.querySelector<HTMLElement>('[data-r="-1"][data-c="0"]')!;
    const stops = () => [...document.querySelectorAll<HTMLElement>('.gl-table [tabindex="0"]')];
    expect(stops()).toHaveLength(1);
    stops()[0].focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect((document.activeElement as HTMLElement).closest('[data-r]')!.getAttribute('data-r')).toBe('0');
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect((document.activeElement as HTMLElement).closest('[data-r]')!.getAttribute('data-c')).toBe('2');
    expect(stops()).toHaveLength(1);
    void first;
  });
  it('pinned rows, empty values, empty state, loading skeleton', () => {
    const { rerender } = render(<T pinnedRows={[{ id: 'best', name: '가장 좋음', score: 95, cost: 1 }]} />);
    expect(document.querySelector('.gl-table__pinned')!.textContent).toContain('가장 좋음');
    expect(document.querySelector('.gl-table__none')).toBeTruthy();
    rerender(<T rows={[]} empty="없음" />);
    expect(screen.getByText('없음')).toBeTruthy();
    rerender(<T rows={[]} loading />);
    expect(document.querySelectorAll('tbody .gl-skeleton').length).toBeGreaterThan(0);
  });
});
