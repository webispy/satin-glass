import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { Breadcrumbs, Skeleton, MediaViewer } from '../src';

describe('Breadcrumbs', () => {
  it('is a navigation landmark; the current page ends it and is not a link', () => {
    render(<Breadcrumbs aria-label="경로" items={[{ label: '홈', href: '/' }, { label: '여행', href: '/trip' }, { label: '서울' }]} />);
    const nav = screen.getByRole('navigation', { name: '경로' });
    expect(nav.querySelectorAll('a')).toHaveLength(2);
    const cur = nav.querySelector('[aria-current="page"]')!;
    expect(cur.textContent).toBe('서울');
    expect(cur.tagName).toBe('SPAN');
  });
  it('folds the middle into a menu button when longer than maxItems', async () => {
    const on = vi.fn();
    render(<Breadcrumbs maxItems={4} moreLabel="더 보기" items={[{ label: 'A', onClick: on }, { label: 'B', onClick: on }, { label: 'C', onClick: on }, { label: 'D', onClick: on }, { label: 'E', onClick: on }, { label: 'F' }]} />);
    expect(screen.queryByText('B')).toBeNull();
    const more = screen.getByRole('button', { name: '더 보기' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    const menu = await screen.findByRole('menu');
    expect([...menu.querySelectorAll('[role=menuitem]')].map((x) => x.textContent)).toEqual(['B', 'C', 'D']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'C' }));
    expect(on).toHaveBeenCalledTimes(1);
  });
  it('does not fold when maxItems is 0', () => {
    render(<Breadcrumbs maxItems={0} items={'ABCDEFG'.split('').map((l) => ({ label: l, href: '#' }))} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(6);
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive technology; text lines render as many bars', () => {
    const { container } = render(<><Skeleton lines={3} /><Skeleton variant="circle" size={32} /></>);
    const [lines, circle] = Array.from(container.children) as HTMLElement[];
    expect(lines.getAttribute('aria-hidden')).toBe('true');
    expect(lines.querySelectorAll('.sg-skeleton')).toHaveLength(3);
    expect(circle.style.width).toBe('32px');
    expect(circle.getAttribute('aria-hidden')).toBe('true');
  });
  it('shares one clock: every skeleton gets a negative sync delay', () => {
    const { container } = render(<Skeleton />);
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--_sync')).toMatch(/^-?\d+(\.\d+)?ms$/);
  });
});

describe('MediaViewer', () => {
  const items = [{ alt: '하나', caption: '첫 사진', width: 4, height: 3, render: () => <div /> }, { alt: '둘', width: 4, height: 3, render: () => <div /> }, { alt: '셋', width: 4, height: 3, render: () => <div /> }];
  function T({ start = 0, onClose = () => {} }: { start?: number; onClose?: () => void }) {
    const [open, setOpen] = useState(true);
    const [i, setI] = useState(start);
    return <MediaViewer open={open} onClose={() => { setOpen(false); onClose(); }} items={items} index={i} onIndexChange={setI} aria-label="사진 보기" labels={{ close: '닫기', previous: '이전', next: '다음' }} />;
  }
  it('is a modal dialog with a counter; arrow keys and buttons page; the ends disable their button', () => {
    render(<T />);
    const dlg = screen.getByRole('dialog', { name: '사진 보기' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(dlg, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(dlg, { key: 'Home' });
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByText('첫 사진')).toBeTruthy();
  });
  it('only the current slide is exposed; neighbours are rendered (preloaded) but hidden', () => {
    const { baseElement } = render(<T start={1} />);
    const slides = [...baseElement.querySelectorAll('[data-sg-slide]')];
    expect(slides.map((s) => s.getAttribute('data-sg-slide'))).toEqual(['0', '1', '2']);
    expect(slides.map((s) => s.getAttribute('aria-hidden'))).toEqual(['true', null, 'true']);
  });
  it('closes with the close button and with Escape', async () => {
    const on = vi.fn();
    const { unmount } = render(<T onClose={on} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(on).toHaveBeenCalledTimes(1);
    unmount();
    const on2 = vi.fn();
    render(<T onClose={on2} />);
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(on2).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
