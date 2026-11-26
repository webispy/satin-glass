import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Button, IconButton, Switch, Slider, SegmentedControl, TextField, Dialog, Menu, MenuItem, TabBar, Tab, Stepper, ThemeProvider, createTheme, Chip, Portal, Tabs,
  Sheet, ActionSheet, Avatar, Badge, Card, useLocale, Toaster, Banner, Meter, Stat, Pagination, WeekdayPicker, DataTable, describeWeekdays,
  Sidebar, SidebarSection, SidebarItem } from '../src';

describe('Button', () => {
  it('renders variants, forwards clicks, and blocks clicks while loading', () => {
    const on = vi.fn();
    const { rerender } = render(<Button variant="filled" onClick={on}>저장</Button>);
    const b = screen.getByRole('button', { name: '저장' });
    expect(b.className).toContain('sg-button--filled');
    fireEvent.click(b); expect(on).toHaveBeenCalledTimes(1);
    rerender(<Button variant="filled" onClick={on} loading>저장</Button>);
    expect((b as HTMLButtonElement).disabled).toBe(true); expect(b.getAttribute('aria-busy')).toBe('true');
  });
  it('renders as a link with component="a"', () => {
    render(<Button component="a" href="/x">이동</Button>);
    expect(screen.getByRole('link', { name: '이동' }).getAttribute('href')).toBe('/x');
  });
  it('is a link when given an href, and a disabled link cannot be followed', () => {
    const on = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const { rerender } = render(<><Button href="/x" onClick={on}>이동</Button><IconButton href="/y" icon="→" label="다음" /></>);
    const a = screen.getByRole('link', { name: '이동' });
    expect(a.tagName).toBe('A'); expect(a.getAttribute('href')).toBe('/x'); expect(a.hasAttribute('type')).toBe(false);
    expect(screen.getByRole('link', { name: '다음' }).getAttribute('href')).toBe('/y');
    fireEvent.click(a); expect(on).toHaveBeenCalledTimes(1);
    rerender(<><Button href="/x" onClick={on} disabled>이동</Button><IconButton href="/y" icon="→" label="다음" /></>);
    const off = screen.getByRole('link', { name: '이동' });
    expect(off.hasAttribute('href')).toBe(false);
    expect(off.getAttribute('aria-disabled')).toBe('true');
    expect(fireEvent.click(off)).toBe(false);   /* default prevented */
    expect(on).toHaveBeenCalledTimes(1);
  });
});

describe('Switch', () => {
  it('toggles uncontrolled and reports changes', () => {
    const on = vi.fn();
    render(<Switch aria-label="Wi-Fi" onChange={on} />);
    const s = screen.getByRole('switch', { name: 'Wi-Fi' });
    expect(s.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(s);
    expect(s.getAttribute('aria-checked')).toBe('true');
    expect(on).toHaveBeenCalledWith(true);
  });
  it('stays put when controlled and the parent ignores the change', () => {
    render(<Switch aria-label="x" checked={false} onChange={() => {}} />);
    const s = screen.getByRole('switch'); fireEvent.click(s);
    expect(s.getAttribute('aria-checked')).toBe('false');
  });
});

describe('Slider', () => {
  it('keyboard moves by step, Home/End jump, value is clamped', () => {
    const end = vi.fn();
    render(<Slider aria-label="거리" defaultValue={50} step={5} onChangeEnd={end} />);
    const s = screen.getByRole('slider');
    fireEvent.keyDown(s, { key: 'ArrowRight' }); expect(s.getAttribute('aria-valuenow')).toBe('55');
    fireEvent.keyDown(s, { key: 'End' }); expect(s.getAttribute('aria-valuenow')).toBe('100');
    fireEvent.keyDown(s, { key: 'ArrowRight' }); expect(s.getAttribute('aria-valuenow')).toBe('100');
    fireEvent.keyDown(s, { key: 'Home' }); expect(s.getAttribute('aria-valuenow')).toBe('0');
    expect(end).toHaveBeenCalledWith(0);
  });
});

describe('SegmentedControl', () => {
  it('is a radiogroup with roving focus and arrow-key selection', () => {
    render(<SegmentedControl aria-label="보기" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' });
    expect(screen.getAllByRole('radio')[2].getAttribute('aria-checked')).toBe('true');
  });
  it('arrow keys, Home and End skip disabled segments', () => {
    render(<SegmentedControl aria-label="보기" options={[{ value: 'a', label: 'A', disabled: true }, { value: 'b', label: 'B' }, { value: 'c', label: 'C', disabled: true }, { value: 'd', label: 'D' }]} defaultValue="b" />);
    const group = screen.getByRole('radiogroup'), checked = () => screen.getAllByRole('radio').findIndex((r) => r.getAttribute('aria-checked') === 'true');
    fireEvent.keyDown(group, { key: 'ArrowRight' }); expect(checked()).toBe(3);
    fireEvent.keyDown(group, { key: 'ArrowRight' }); expect(checked()).toBe(1);
    fireEvent.keyDown(group, { key: 'End' }); expect(checked()).toBe(3);
    fireEvent.keyDown(group, { key: 'Home' }); expect(checked()).toBe(1);
  });
});

describe('TabBar', () => {
  it('renders tabs and selects on click', () => {
    const on = vi.fn();
    render(<TabBar aria-label="메인" onChange={on}><Tab value="home" label="홈" /><Tab value="map" label="지도" /></TabBar>);
    fireEvent.click(screen.getByRole('tab', { name: '지도' }));
    expect(on).toHaveBeenCalledWith('map');
    expect(screen.getByRole('tab', { name: '지도' }).getAttribute('aria-selected')).toBe('true');
  });
  it('keeps the tabs (and arrow keys) inside one tablist when the track scrolls', () => {
    render(<TabBar aria-label="메인"><Tab value="home" label="홈" /><Tab value="map" label="지도" disabled /><Tab value="me" label="나" /></TabBar>);
    const list = screen.getByRole('tablist');
    expect(list.querySelectorAll(':scope > [role=tab]').length).toBe(3);
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '나' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('TextField', () => {
  it('links label, helper and error; clear button empties an uncontrolled field', () => {
    render(<TextField label="이름" defaultValue="헤론" clearable error="필수 항목" />);
    const input = screen.getByLabelText('이름') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toBe('필수 항목');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(input.value).toBe('');
  });
});

describe('Stepper', () => {
  it('respects min and max', () => {
    render(<Stepper label="인원" defaultValue={1} min={1} max={2} />);
    expect((screen.getByRole('button', { name: 'Decrease 인원' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Increase 인원' }));
    expect(screen.getByText('2')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Increase 인원' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Chip', () => {
  it('toggles aria-pressed through onSelectedChange', () => {
    function T() { const [on, set] = useState(false); return <Chip selected={on} onSelectedChange={set}>바다</Chip>; }
    render(<T />);
    const c = screen.getByRole('button', { name: '바다' });
    fireEvent.click(c); expect(c.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Dialog', () => {
  it('opens as a modal alertdialog, closes on Escape and unmounts after the exit', async () => {
    function T() {
      const [open, setOpen] = useState(true);
      return <Dialog open={open} onClose={() => setOpen(false)} title="삭제할까요?" actions={<Button>취소</Button>}>되돌릴 수 없어요.</Dialog>;
    }
    render(<T />);
    const d = screen.getByRole('alertdialog', { name: '삭제할까요?' });
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('Menu', () => {
  it('focuses the first item, moves with arrows and selects', async () => {
    const pick = vi.fn();
    function T() {
      const ref = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false);
      return (<>
        <button ref={ref} onClick={() => setOpen(true)}>열기</button>
        <Menu open={open} onClose={() => setOpen(false)} anchor={ref.current} aria-label="메뉴">
          <MenuItem>하나</MenuItem><MenuItem onSelect={pick}>둘</MenuItem>
        </Menu>
      </>);
    }
    render(<T />);
    fireEvent.click(screen.getByText('열기'));
    const menu = await screen.findByRole('menu');
    expect(document.activeElement?.textContent).toBe('하나');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('둘');
    fireEvent.click(document.activeElement!);
    expect(pick).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});

describe('ThemeProvider', () => {
  it('sets the theme name and token overrides on its element', () => {
    const { container } = render(<ThemeProvider theme={createTheme({ mode: 'dark', contrast: 'more', tokens: { accent: '#0a7' } })}><span /></ThemeProvider>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.sgTheme).toBe('dark-hc');
    expect(root.style.getPropertyValue('--sg-accent')).toBe('#0a7');
  });
  it('draws grooves inset by default; a nested theme inherits flat unless it sets its own', () => {
    const { container } = render(
      <ThemeProvider theme={createTheme({ grooves: 'flat' })}>
        <ThemeProvider theme={createTheme({ mode: 'dark' })}><i /></ThemeProvider>
        <ThemeProvider theme={createTheme({ grooves: 'inset' })}><b /></ThemeProvider>
      </ThemeProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.sgGrooves).toBe('flat');
    expect(container.querySelector('i')!.parentElement!.dataset.sgGrooves).toBe('flat');
    expect(container.querySelector('b')!.parentElement!.dataset.sgGrooves).toBe('inset');
    const { container: plain } = render(<ThemeProvider><span /></ThemeProvider>);
    expect((plain.firstElementChild as HTMLElement).dataset.sgGrooves).toBe('inset');
  });
});

describe('Locale', () => {
  const ko = createTheme({ locale: 'ko-KR' });
  function Show({ id }: { id: string }) { return <output data-testid={id}>{useLocale()}</output>; }
  it('resolves the nearest provider that sets one, else en-US; only a set locale becomes lang', () => {
    render(<>
      <Show id="none" />
      <ThemeProvider theme={ko} data-testid="ko">
        <Show id="outer" />
        <ThemeProvider theme={createTheme({ mode: 'dark' })} data-testid="dark"><Show id="inherit" /></ThemeProvider>
        <ThemeProvider theme={createTheme({ locale: 'ja-JP' })} data-testid="ja"><Show id="inner" /></ThemeProvider>
      </ThemeProvider>
    </>);
    expect(['none', 'outer', 'inherit', 'inner'].map((id) => screen.getByTestId(id).textContent)).toEqual(['en-US', 'ko-KR', 'ko-KR', 'ja-JP']);
    expect(screen.getByTestId('ko').getAttribute('lang')).toBe('ko-KR');
    expect(screen.getByTestId('dark').hasAttribute('lang')).toBe(false);
    expect(screen.getByTestId('ja').getAttribute('lang')).toBe('ja-JP');
  });
  it("a component's own locale beats the provider's", () => {
    render(<ThemeProvider theme={ko}><WeekdayPicker aria-label="themed" /><WeekdayPicker aria-label="own" locale="en-US" /></ThemeProvider>);
    expect(screen.getByRole('group', { name: 'themed' }).querySelector('button')!.getAttribute('aria-label')).toBe('일요일');
    expect(screen.getByRole('group', { name: 'own' }).querySelector('button')!.getAttribute('aria-label')).toBe('Sunday');
    /* an override is marked in its own language; the rest inherit the provider's lang */
    expect(screen.getByRole('group', { name: 'own' }).getAttribute('lang')).toBe('en-US');
    expect(screen.getByRole('group', { name: 'themed' }).hasAttribute('lang')).toBe(false);
  });
  it('portals carry the lang and the words', () => {
    render(<>
      <ThemeProvider theme={ko}><Portal><span data-testid="ko" /></Portal><Toaster /></ThemeProvider>
      <ThemeProvider><Portal><span data-testid="unset" /></Portal></ThemeProvider>
    </>);
    expect(screen.getByTestId('ko').parentElement!.getAttribute('lang')).toBe('ko-KR');
    expect(screen.getByTestId('unset').parentElement!.hasAttribute('lang')).toBe(false);
    expect(screen.getByRole('region', { name: '알림' })).toBeTruthy();
  });
  it('built-in words in English by default and in Korean for ko; explicit labels win', () => {
    const { unmount } = render(<>
      <Banner title="t" onDismiss={() => {}} />
      <Meter label="m" value={37} /><Meter label="n" value={Number.NaN} />
      <Pagination page={2} pageCount={5} onChange={() => {}} />
    </>);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'm' }).getAttribute('aria-valuetext')).toBe('37%');
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeTruthy();
    unmount();
    render(<ThemeProvider theme={ko}>
      <Banner title="t" onDismiss={() => {}} /><Banner title="u" onDismiss={() => {}} dismissLabel="알림 닫기" />
      <Meter label="n" value={Number.NaN} />
      <Stat label="s" value="1" delta="+3%" />
      <Pagination page={2} pageCount={5} onChange={() => {}} />
    </ThemeProvider>);
    expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '알림 닫기' })).toBeTruthy();
    expect(screen.getByText('알 수 없음')).toBeTruthy();
    expect(screen.getByText('증가')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: '페이지 이동' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeTruthy();
  });
  it('describeWeekdays is plain: en-US unless given a locale', () => {
    expect(describeWeekdays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeWeekdays([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(describeWeekdays([1, 2, 3, 4, 5], { locale: 'ko-KR' })).toBe('주중');
  });
  it('DataTable sorts text the locale\'s way, digits by value', () => {
    type R = { id: string; name: string };
    const rows: R[] = ['ä', 'z', 'b', 'item 10', 'item 2'].map((name, i) => ({ id: String(i), name }));
    const T = (p: { locale?: string }) => <DataTable<R> aria-label="t" rows={rows} rowKey={(r) => r.id} columns={[{ key: 'name', header: 'Name', sortable: true }]} defaultSort={{ key: 'name', dir: 'asc' }} {...p} />;
    const names = (c: HTMLElement) => [...c.querySelectorAll('tbody:last-of-type tr')].map((tr) => tr.querySelector('th')?.textContent);
    const en = render(<T />);
    expect(names(en.container)).toEqual(['ä', 'b', 'item 2', 'item 10', 'z']);
    en.unmount();
    const sv = render(<ThemeProvider theme={createTheme({ locale: 'sv-SE' })}><T /></ThemeProvider>);
    expect(names(sv.container)).toEqual(['b', 'item 2', 'item 10', 'z', 'ä']);
    sv.unmount();
    expect(names(render(<ThemeProvider theme={createTheme({ locale: 'sv-SE' })}><T locale="en-US" /></ThemeProvider>).container)).toEqual(['ä', 'b', 'item 2', 'item 10', 'z']);
  });
});

describe('Overlay unmounted while open', () => {
  it('releases the scroll lock and focus trap (e.g. a route change mid-animation)', () => {
    const { unmount } = render(<Dialog open onClose={() => {}} title="열림">내용</Dialog>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('Chip with remove', () => {
  it('is a group with its own remove button (no button inside a button)', () => {
    const rm = vi.fn();
    render(<Chip onRemove={rm}>서울</Chip>);
    const remove = screen.getByRole('button', { name: 'Remove 서울' });
    expect(remove.closest('button')).toBe(remove);
    expect(remove.parentElement?.closest('button')).toBeNull();
    fireEvent.click(remove); expect(rm).toHaveBeenCalled();
  });
  it('puts the ref and other attributes on the chip, disabled on the remove button', () => {
    const ref = { current: null as HTMLElement | null };
    render(<Chip ref={ref} onRemove={() => {}} id="c1" data-city="seoul" title="도시" disabled>서울</Chip>);
    const chip = screen.getByRole('group', { name: '서울' });
    expect(ref.current).toBe(chip);
    expect([chip.id, chip.dataset.city, chip.title]).toEqual(['c1', 'seoul', '도시']);
    expect((screen.getByRole('button', { name: 'Remove 서울' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Sheet', () => {
  /* drag the grabber down by dy px and let go */
  const swipe = (el: Element, dy: number) => {
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100, clientY: 100, button: 0, pointerType: 'touch' });
    for (let y = 10; y <= dy; y += 10) fireEvent.pointerMove(window, { pointerId: 1, clientX: 100, clientY: 100 + y });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 100, clientY: 100 + dy });
  };
  it('a swipe down closes it only when dismissible; a refused one springs back', () => {
    const close = vi.fn();
    const { rerender } = render(<Sheet open onClose={close} title="필터" dismissible={false}>내용</Sheet>);
    const panel = screen.getByRole('dialog', { name: '필터' });
    const handle = panel.querySelector('[data-sg-drag]')!;
    swipe(handle, 400);
    expect(close).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('');
    rerender(<Sheet open onClose={close} title="필터">내용</Sheet>);
    swipe(handle, 400);
    expect(close).toHaveBeenCalledWith('swipe');
  });
  it('a refused swipe resists: the sheet follows the finger only a little', () => {
    render(<Sheet open onClose={() => {}} title="필터" dismissible={false}>내용</Sheet>);
    const panel = screen.getByRole('dialog', { name: '필터' });
    const handle = panel.querySelector('[data-sg-drag]')!;
    fireEvent.pointerDown(handle, { pointerId: 2, clientX: 100, clientY: 100, button: 0, pointerType: 'touch' });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 100, clientY: 110 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 100, clientY: 200 });
    const y = parseFloat(panel.style.transform.replace('translateY(', ''));
    expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(30);
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 100, clientY: 200 });
  });
});

describe('ActionSheet', () => {
  it('without a title takes its name from aria-label or aria-labelledby', () => {
    const { rerender } = render(<ActionSheet open onClose={() => {}} aria-label="사진" actions={[{ label: '삭제' }]} />);
    expect(screen.getByRole('dialog', { name: '사진' })).toBeTruthy();
    rerender(<><h2 id="as-h">앨범</h2><ActionSheet open onClose={() => {}} aria-labelledby="as-h" actions={[{ label: '삭제' }]} /></>);
    expect(screen.getByRole('dialog', { name: '앨범' })).toBeTruthy();
    rerender(<ActionSheet open onClose={() => {}} title="공유" aria-label="사진" actions={[{ label: '삭제' }]} />);
    expect(screen.getByRole('dialog', { name: '공유' })).toBeTruthy();
  });
});

describe('Avatar and Badge', () => {
  it('an avatar without a name is decorative; with one it is a named image', () => {
    const { container, rerender } = render(<Avatar />);
    const el = container.querySelector('.sg-avatar')!;
    expect(el.getAttribute('aria-hidden')).toBe('true'); expect(el.hasAttribute('role')).toBe(false);
    rerender(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' }).textContent).toBe('AL');
  });
  it('a badge, a dot too, can be named with label (or aria-label)', () => {
    render(<><Badge dot label="새 메시지" /><Badge aria-label="알림 3개">{3}</Badge><Badge>{5}</Badge></>);
    expect(screen.getByRole('img', { name: '새 메시지' }).className).toContain('sg-badge--dot');
    expect(screen.getByRole('img', { name: '알림 3개' }).textContent).toBe('3');
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });
});

describe('Card', () => {
  it('interactive is a button that takes button attributes; plain is a div', () => {
    const on = vi.fn();
    const ref = { current: null as HTMLElement | null };
    const { rerender } = render(<Card ref={ref} interactive onClick={on} name="pick">장소</Card>);
    const b = screen.getByRole('button', { name: '장소' });
    expect(ref.current).toBe(b); expect(b.getAttribute('type')).toBe('button'); expect(b.getAttribute('name')).toBe('pick');
    fireEvent.click(b); expect(on).toHaveBeenCalled();
    rerender(<Card ref={ref}>장소</Card>);
    expect(ref.current?.tagName).toBe('DIV');
  });
});

describe('Disabled slider', () => {
  it('ignores the keyboard', () => {
    render(<Slider aria-label="d" disabled defaultValue={40} />);
    const s = screen.getByRole('slider');
    fireEvent.keyDown(s, { key: 'End' });
    expect(s.getAttribute('aria-valuenow')).toBe('40');
  });
});

describe('roving groups with a disabled first item', () => {
  it('keep an enabled item in the tab order', () => {
    render(<SegmentedControl aria-label="seg" options={[{ value: 'a', label: 'A', disabled: true }, { value: 'b', label: 'B' }]} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0]);
  });
  it('keep one even when the chosen value is disabled', () => {
    render(<TabBar aria-label="bar" value="a"><Tab value="a" label="A" disabled /><Tab value="b" label="B" /></TabBar>);
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, 0]);
    render(<Tabs aria-label="tabs" value="a" items={[{ value: 'a', label: 'A', disabled: true, content: 'a' }, { value: 'b', label: 'B', content: 'b' }]} />);
    expect(screen.getAllByRole('tab').slice(2).map((t) => t.tabIndex)).toEqual([-1, 0]);
  });
});

describe('Portal', () => {
  it('writes no theme settings without a ThemeProvider (the system ones apply)', () => {
    render(<Portal><span data-testid="out" /></Portal>);
    const host = screen.getByTestId('out').parentElement!;
    expect(host.hasAttribute('data-sg-reduce-motion')).toBe(false);
    expect(host.hasAttribute('data-sg-theme')).toBe(false);
  });
  it('carries the resolved settings inside one', () => {
    render(<ThemeProvider theme={createTheme({ mode: 'dark', reduceMotion: true, grooves: 'flat' })}><Portal><span data-testid="in" /></Portal></ThemeProvider>);
    const host = screen.getByTestId('in').parentElement!;
    expect(host.dataset.sgReduceMotion).toBe('true');
    expect(host.dataset.sgTheme).toBe('dark');
    expect(host.dataset.sgGrooves).toBe('flat');
  });
});

describe('Sidebar', () => {
  it('floats as glass by default; attached is an opaque panel with no glass, whatever `glass` says', () => {
    const { container, rerender } = render(<Sidebar aria-label="Docs"><SidebarItem>Home</SidebarItem></Sidebar>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('sg-glass');
    expect(root.className).not.toContain('sg-sidebar--attached');
    rerender(<Sidebar aria-label="Docs" attached glass><SidebarItem>Home</SidebarItem></Sidebar>);
    expect(root.className).toContain('sg-sidebar--attached');
    expect(root.className).not.toContain('sg-glass');
    rerender(<Sidebar aria-label="Docs" glass={false}><SidebarItem>Home</SidebarItem></Sidebar>);
    expect(root.className).not.toContain('sg-glass');
  });
  it('names the navigation landmark; header and footer sit outside it, in order, and only when given', () => {
    const { container, rerender } = render(
      <Sidebar aria-label="Sessions" header={<span>Brand</span>} footer={<button type="button">New session</button>}>
        <SidebarItem>One</SidebarItem>
      </Sidebar>,
    );
    const nav = screen.getByRole('navigation', { name: 'Sessions' });
    expect(nav.contains(screen.getByText('One'))).toBe(true);
    expect(nav.contains(screen.getByText('Brand'))).toBe(false);
    expect(nav.contains(screen.getByRole('button', { name: 'New session' }))).toBe(false);
    const frame = container.querySelector('.sg-sidebar__frame')!;
    expect([...frame.children].map((e) => e.className)).toEqual(['sg-sidebar__header', 'sg-sidebar__scroll', 'sg-sidebar__footer']);
    expect(container.firstElementChild!.hasAttribute('aria-label')).toBe(false);
    rerender(<Sidebar aria-label="Sessions" header={null} footer={false}><SidebarItem>One</SidebarItem></Sidebar>);
    expect(container.querySelector('.sg-sidebar__header, .sg-sidebar__footer')).toBeNull();
    rerender(<Sidebar aria-label="Sessions" header={true} footer={0}><SidebarItem>One</SidebarItem></Sidebar>);
    expect(container.querySelector('.sg-sidebar__header')).toBeNull();
    expect(container.querySelector('.sg-sidebar__footer')?.textContent).toBe('0');
  });
  it('forwards its ref to the panel; role and the landmark name and description go to the one <nav>', () => {
    let el: HTMLElement | null = null;
    render(<><Sidebar ref={(e) => { el = e; }} id="side" role="navigation" aria-label="Docs" aria-describedby="hint"><SidebarItem>Home</SidebarItem></Sidebar><p id="hint">All pages</p></>);
    expect(el!.classList.contains('sg-sidebar')).toBe(true);
    expect(el!.id).toBe('side');
    expect(el!.hasAttribute('role')).toBe(false);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Docs' }).getAttribute('aria-describedby')).toBe('hint');
  });
  it('a section is a group named by its header; without one (untyped callers) it is an unnamed group', () => {
    render(
      <Sidebar aria-label="Docs">
        <SidebarSection header="Library"><SidebarItem>All</SidebarItem><SidebarItem>Starred</SidebarItem></SidebarSection>
        <SidebarSection header={undefined as unknown as string}><SidebarItem>Loose</SidebarItem></SidebarSection>
        <SidebarSection header={0}><SidebarItem>Zero</SidebarItem></SidebarSection>
        <SidebarSection header={true}><SidebarItem>Flag</SidebarItem></SidebarSection>
      </Sidebar>,
    );
    const lib = screen.getByRole('group', { name: 'Library' });
    expect(lib.contains(screen.getByRole('button', { name: 'Starred' }))).toBe(true);
    expect(screen.getByRole('group', { name: '0' }).contains(screen.getByRole('button', { name: 'Zero' }))).toBe(true);
    const loose = screen.getByRole('button', { name: 'Loose' }).closest('[role="group"]')!;
    expect(loose.hasAttribute('aria-labelledby')).toBe(false);
    const flag = screen.getByRole('button', { name: 'Flag' }).closest('[role="group"]')!;
    expect(flag.hasAttribute('aria-labelledby')).toBe(false);
    expect(flag.querySelector('.sg-sidebar__section-header')).toBeNull();
  });
  it('the label and count name an item, as they show; the subtitle describes it', () => {
    const { rerender } = render(
      <Sidebar aria-label="Docs"><SidebarItem icon={<svg />} subtitle="direct · haiku" count={3} selected>Quarterly report</SidebarItem></Sidebar>,
    );
    const item = screen.getByRole('button', { name: 'Quarterly report 3' });
    expect(item.getAttribute('aria-current')).toBe('page');
    const sub = document.getElementById(item.getAttribute('aria-describedby')!)!;
    expect(sub.textContent).toBe('direct · haiku');
    expect(sub.getAttribute('aria-hidden')).toBe('true');
    /* an icon with a name of its own still names an icon-only item, as in 0.5 */
    /* an app's own description is kept beside the subtitle; its own name wins */
    rerender(<Sidebar aria-label="Docs"><SidebarItem subtitle="sub" aria-label="Report, 3 turns" aria-describedby="ext">Report</SidebarItem><span id="ext">extra</span></Sidebar>);
    const own = screen.getByRole('button', { name: 'Report, 3 turns' });
    expect(own.getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)!.textContent)).toEqual(['sub', 'extra']);
    rerender(<Sidebar aria-label="Docs"><SidebarItem icon={<img alt="Settings" />} /></Sidebar>);
    screen.getByRole('button', { name: 'Settings' });
    rerender(<Sidebar aria-label="Docs"><SidebarItem href="/x">Plain</SidebarItem></Sidebar>);
    const link = screen.getByRole('link', { name: 'Plain' });
    expect(link.hasAttribute('aria-describedby')).toBe(false);
  });
});
