import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Button, Switch, Slider, SegmentedControl, TextField, Dialog, Menu, MenuItem, TabBar, Tab, Stepper, ThemeProvider, createTheme, Chip } from '../src';

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
});

describe('Disabled slider', () => {
  it('ignores the keyboard', () => {
    render(<Slider aria-label="d" disabled defaultValue={40} />);
    const s = screen.getByRole('slider');
    fireEvent.keyDown(s, { key: 'End' });
    expect(s.getAttribute('aria-valuenow')).toBe('40');
  });
});
