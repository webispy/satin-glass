import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Activity, Suspense, type ReactElement } from 'react';
import { MediaViewer, ThemeProvider, createTheme } from '../src';

/* MediaViewer hidden by Suspense or Activity and shown again, or re-opened before its exit has ended (#105) */
const items = [
  { alt: 'one', width: 800, height: 600, render: () => <div /> },
  { alt: 'two', width: 800, height: 600, render: () => <div /> },
];
const frames: FrameRequestCallback[] = [];
let t = 0;
const step = (n = 1) => { for (let i = 0; i < n; i++) { t += 16; for (const cb of frames.splice(0)) cb(t); } };
const settle = () => act(() => { for (let i = 0; i < 300 && frames.length; i++) step(); });
/* jsdom lays nothing out: the stage is given a size, so a zoomed photo has somewhere to pan */
const mockFrames = () => {
  t = performance.now();
  const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-media__stage') ? 1000 : 0; });
  const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-media__stage') ? 700 : 0; });
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length; });
  const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  return () => { raf.mockRestore(); caf.mockRestore(); cw.mockRestore(); ch.mockRestore(); frames.length = 0; };
};
let restore = () => {};
afterEach(() => restore());

const gate = { hold: false, wake: () => {} };
function Gate() { if (gate.hold) throw new Promise<void>((r) => { gate.wake = r; }); return null; }
type Hider = { name: string; wrap: (shown: boolean, ui: ReactElement) => ReactElement; hide: (re: (ui: ReactElement) => void, ui: (shown: boolean) => ReactElement) => Promise<void>; reveal: (re: (ui: ReactElement) => void, ui: (shown: boolean) => ReactElement) => Promise<void> };
const hiders: Hider[] = [
  { name: 'Activity', wrap: (shown, ui) => <Activity mode={shown ? 'visible' : 'hidden'}>{ui}</Activity>,
    hide: async (re, ui) => { re(ui(false)); await act(async () => {}); }, reveal: async (re, ui) => { re(ui(true)); await act(async () => {}); } },
  { name: 'Suspense', wrap: (_, ui) => <Suspense fallback={<p>loading</p>}>{ui}<Gate /></Suspense>,
    hide: async (re, ui) => { gate.hold = true; re(ui(true)); await act(async () => {}); },
    reveal: async (re, ui) => { gate.hold = false; re(ui(true)); await act(async () => { gate.wake(); }); } },
];

const frameOf = () => document.querySelector<HTMLElement>('[data-sg-slide="0"] .sg-media__frame')!;
const xOf = (tr: string) => Number(/translate\(([-\d.]+)px/.exec(tr)?.[1] ?? NaN);

describe('MediaViewer shown again (#105)', () => {
  for (const h of hiders) {
    it(`${h.name}: a zoomed photo is drawn as the keys take it: zoomed and panned, or (entered again) at 1`, async () => {
      restore = mockFrames();
      const ui = (shown: boolean) => <ThemeProvider theme={createTheme({ reduceMotion: false })}>
        <button id="thumb">thumb</button>{h.wrap(shown, <MediaViewer open onClose={() => {}} items={items} getOrigin={() => document.getElementById('thumb')} aria-label="photos" />)}</ThemeProvider>;
      const { rerender } = render(ui(true));
      await act(async () => {}); await settle();
      const dlg = screen.getByRole('dialog');
      fireEvent.keyDown(dlg, { key: '+' }); await settle();
      const zoomedAt = frameOf().style.transform;
      expect(zoomedAt).toContain('scale(');
      await h.hide(rerender, ui); await h.reveal(rerender, ui); await settle();
      if (h.name === 'Activity') {
        /* Activity disconnects every effect, so the opening enters again (#104): the photo is then at 1, drawn so,
           and the arrow pages, as the viewer takes it to be (the photo looked zoomed while the keys paged it) */
        expect(frameOf().style.transform).toBe('');
        expect(screen.getByRole('dialog').hasAttribute('data-zoomed')).toBe(false);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' }); await settle();
        expect(document.querySelector('.sg-media__count')!.textContent).toBe('2 / 2');
        return;
      }
      expect(frameOf().style.transform).toBe(zoomedAt);
      expect(screen.getByRole('dialog').hasAttribute('data-zoomed')).toBe(true);
      /* the arrow pans the zoomed photo: it does not page to the next one */
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' }); await settle();
      expect(document.querySelector('.sg-media__count')!.textContent).toBe('1 / 2');
      expect(xOf(frameOf().style.transform)).toBeLessThan(xOf(zoomedAt));
    });
    it(`${h.name}: a dismiss drag cut short by the hide leaves the photo and the backdrop at rest`, async () => {
      restore = mockFrames();
      const ui = (shown: boolean) => <ThemeProvider theme={createTheme({ reduceMotion: false })}>
        <button id="thumb">thumb</button>{h.wrap(shown, <MediaViewer open onClose={() => {}} items={items} getOrigin={() => document.getElementById('thumb')} aria-label="photos" />)}</ThemeProvider>;
      const { rerender } = render(ui(true));
      await act(async () => {}); await settle();
      const stage = document.querySelector<HTMLElement>('.sg-media__stage')!;
      const at = (y: number) => ({ pointerId: 7, button: 0, pointerType: 'mouse', clientX: 200, clientY: 200 + y });
      fireEvent.pointerDown(stage, at(0));
      fireEvent.pointerMove(window, at(40)); fireEvent.pointerMove(window, at(90));
      const layer = document.querySelector<HTMLElement>('[data-sg-slide="0"] .sg-media__dismiss')!;
      expect(layer.style.transform).not.toBe('');
      await h.hide(rerender, ui);
      fireEvent.pointerUp(window, at(300));   /* let go over the fallback, or the hidden tree: it must not close it */
      await h.reveal(rerender, ui); await settle();
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(document.querySelector<HTMLElement>('[data-sg-slide="0"] .sg-media__dismiss')!.style.transform).toBe('');
      expect(document.querySelector<HTMLElement>('.sg-media__backdrop')!.style.opacity).toBe('');
    });
  }
  it('re-opened while its exit still runs: the new opening keeps its thumbnail hidden and the focus', async () => {
    restore = mockFrames();
    let finish: () => void = () => {};
    const anim = vi.spyOn(Element.prototype, 'animate').mockImplementation(function () {
      return { finished: new Promise<void>((r) => { const prev = finish; finish = () => { prev(); r(); }; }), cancel() {}, finish() {}, onfinish: null, playState: 'running' } as unknown as Animation;
    });
    try {
      const ui = (open: boolean) => <ThemeProvider theme={createTheme({ reduceMotion: false })}>
        <button id="thumb">thumb</button><MediaViewer open={open} onClose={() => {}} items={items} getOrigin={() => document.getElementById('thumb')} aria-label="photos" /></ThemeProvider>;
      const { rerender } = render(ui(true));
      await act(async () => {}); await settle();
      const thumb = document.getElementById('thumb')!;
      expect(thumb.style.visibility).toBe('hidden');
      rerender(ui(false)); await act(async () => {});   /* the exit runs, not finished */
      rerender(ui(true)); await act(async () => {}); await settle();
      expect(thumb.style.visibility).toBe('hidden');
      const dlg = screen.getByRole('dialog');
      expect(dlg.contains(document.activeElement)).toBe(true);
      await act(async () => { finish(); await Promise.resolve(); await Promise.resolve(); });   /* the old exit ends now */
      expect(thumb.style.visibility).toBe('hidden');
      expect(dlg.contains(document.activeElement)).toBe(true);
    } finally { anim.mockRestore(); }
  });
});
