import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { focusables, trapFocus, pushLayer, inLayerAbove, tabFrom } from '../src';

/* jsdom lays nothing out: offsetParent is always null. Stand in for layout: an element in the document and not under
   display: none has its parent as offsetParent. */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      for (let e: HTMLElement | null = this; e; e = e.parentElement) if (e.style.display === 'none') return null;
      return this.isConnected ? this.parentElement : null;
    },
  });
});
afterEach(() => { document.body.innerHTML = ''; });

const html = (s: string) => { const d = document.createElement('div'); d.innerHTML = s; document.body.appendChild(d); return d; };
const tab = (root: HTMLElement, shiftKey = false) => root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));

describe('focusables', () => {
  it('leaves out what Tab cannot reach: inside [inert], visibility: hidden, all but one radio of a group', () => {
    const d = html(`<button id="a">a</button><div inert><button id="b">b</button></div><button id="c" style="visibility:hidden">c</button>
      <input type="radio" name="g" id="r1"><input type="radio" name="g" id="r2" checked><input type="radio" name="g" id="r3">
      <input type="radio" name="h" id="s1"><input type="radio" name="h" id="s2"><button id="z">z</button>`);
    expect(focusables(d).map((e) => e.id)).toEqual(['a', 'r2', 's1', 'z']);
    (d.querySelector('#r3') as HTMLElement).focus();   /* the focused radio is the group's stop */
    expect(focusables(d).map((e) => e.id)).toEqual(['a', 'r3', 's1', 'z']);
  });
  it('leaves out native controls taken out of the order with tabindex="-1"', () => {
    const d = html('<button id="a">a</button><button id="b" tabindex="-1">b</button><input id="c" tabindex="-1"><a href="#" id="e" tabindex="-1">e</a>');
    expect(focusables(d).map((e) => e.id)).toEqual(['a']);
  });
  it('leaves out controls in a disabled fieldset (the browser skips them; the edge of a popover is before them)', () => {
    const d = html('<button id="a">a</button><fieldset disabled><button id="b">b</button><input id="c"></fieldset><button id="z">z</button>');
    expect(focusables(d).map((e) => e.id)).toEqual(['a', 'z']);
  });
  it('groups radios in one pass', () => {
    const d = html(Array.from({ length: 300 }, (_, i) => `<input type="radio" name="g${i % 3}">`).join(''));
    const name = vi.spyOn(HTMLInputElement.prototype, 'name', 'get');
    expect(focusables(d)).toHaveLength(3);
    expect(name.mock.calls.length).toBeLessThan(300 * 5);   /* a scan per radio would read names 300 × 300 times */
    name.mockRestore();
  });
});

describe('trapFocus', () => {
  it('passes over a stop that refuses focus instead of holding Tab where it is', () => {
    const d = html('<button id="a">a</button><button id="b">b</button><button id="c">c</button>');
    const release = trapFocus(d);
    expect(document.activeElement?.id).toBe('a');
    (d.querySelector('#b') as HTMLElement).focus = () => {};   /* e.g. disabled a moment ago */
    tab(d); expect(document.activeElement?.id).toBe('c');
    tab(d); expect(document.activeElement?.id).toBe('a');
    tab(d, true); expect(document.activeElement?.id).toBe('c');
    release();
  });

  it('gives focus back to the layer below when its opener has gone (a menu item that opened a dialog)', () => {
    const trigger = html('<button id="t">open</button>').firstElementChild as HTMLElement;
    const menu = html('<div><button id="item">item</button></div>');
    const popMenu = pushLayer(() => {}, false, menu, { inert: false, back: () => trigger });
    (menu.querySelector('#item') as HTMLElement).focus();
    const dialog = html('<div><button id="ok">ok</button></div>');
    const popDialog = pushLayer(() => {}, true, dialog);
    const release = trapFocus(dialog);
    expect(document.activeElement?.id).toBe('ok');
    popMenu(); menu.remove();   /* the menu closes and unmounts under the dialog */
    popDialog(); release();
    expect(document.activeElement).toBe(trigger);
  });

  it('gives focus back to the layer below when its opener is still there but folding away (inert) or refuses focus', () => {
    for (const refuse of ['inert', 'focus'] as const) {
      const trigger = html('<button id="t">open</button>').firstElementChild as HTMLElement;
      const menu = html('<div><button id="item">item</button></div>'), item = menu.querySelector('#item') as HTMLElement;
      const popMenu = pushLayer(() => {}, false, menu, { inert: false, back: () => trigger });
      item.focus();
      const dialog = html('<div><button id="ok">ok</button></div>');
      const popDialog = pushLayer(() => {}, true, dialog);
      const release = trapFocus(dialog);
      popMenu();   /* the menu's exit has begun: it is still in the document */
      if (refuse === 'inert') menu.setAttribute('inert', ''); else item.focus = () => {};
      popDialog(); release();
      expect(document.activeElement, refuse).toBe(trigger);
      document.body.innerHTML = '';
    }
  });

  it('goes on down the chain while an opener is connected but refuses focus (hidden in a layer still open)', () => {
    const a = html('<button id="a">a</button>').firstElementChild as HTMLElement;
    a.focus();
    const sheet = html('<div><button id="b">b</button></div>'), b = sheet.querySelector('#b') as HTMLElement;
    const popSheet = pushLayer(() => {}, true, sheet); const relSheet = trapFocus(sheet, b);
    const dialog = html('<div><button id="c">c</button></div>'), c = dialog.querySelector('#c') as HTMLElement;
    const popDialog = pushLayer(() => {}, true, dialog); const relDialog = trapFocus(dialog, c);
    const top = html('<div><button id="d">d</button></div>');
    const popTop = pushLayer(() => {}, true, top); const relTop = trapFocus(top);
    c.remove(); b.focus = () => {};   /* the opener gone, the one below it connected but refusing focus */
    popTop(); relTop();
    expect(document.activeElement).toBe(a);
    popDialog(); relDialog(); popSheet(); relSheet();
  });
  it('a dialog opened from a dialog that has itself closed goes back to the first one\'s opener', () => {
    const opener = html('<button id="o">o</button>').firstElementChild as HTMLElement;
    opener.focus();
    const sheet = html('<div><button id="row">row</button></div>');
    const popSheet = pushLayer(() => {}, true, sheet); const relSheet = trapFocus(sheet);
    const dialog = html('<div><button id="ok">ok</button></div>');
    const popDialog = pushLayer(() => {}, true, dialog); const relDialog = trapFocus(dialog);
    popSheet(); relSheet(); sheet.remove();
    popDialog(); relDialog();
    expect(document.activeElement).toBe(opener);
  });
});

describe('tabFrom', () => {
  it('outside a trap, the layer that holds the element decides', () => {
    const panel = html('<button id="p">p</button>');
    const tab = vi.fn(() => true);
    const pop = pushLayer(() => {}, false, panel, { inert: false, tab });
    expect(tabFrom(panel.querySelector('#p') as HTMLElement, true)).toBe(true);
    expect(tab).toHaveBeenCalledWith(panel.querySelector('#p'), true);
    pop();
    expect(tabFrom(panel.querySelector('#p') as HTMLElement)).toBe(false);
  });

  it('moves on from an element inside a trap, and leaves the rest to the browser', () => {
    const d = html('<button id="a">a</button><button id="b">b</button>');
    const outside = html('<button id="x">x</button>').firstElementChild as HTMLElement;
    const release = trapFocus(d);
    expect(tabFrom(d.querySelector('#b') as HTMLElement)).toBe(true);
    expect(document.activeElement?.id).toBe('a');   /* wraps inside the trap */
    expect(tabFrom(d.querySelector('#a') as HTMLElement, true)).toBe(true);
    expect(document.activeElement?.id).toBe('b');
    expect(tabFrom(outside)).toBe(false);
    release();
  });
});

describe('layer stack', () => {
  it('a press inside a layer opened above is not outside the one below', () => {
    const popover = html('<div>popover</div>'), list = html('<ul><li>option</li></ul>'), page = html('<p>page</p>');
    const a = pushLayer(() => {}, false, popover.firstElementChild as HTMLElement, { inert: false });
    const b = pushLayer(() => {}, false, list.firstElementChild as HTMLElement, { inert: false });
    expect(inLayerAbove(popover.firstElementChild as HTMLElement, list.querySelector('li'))).toBe(true);
    expect(inLayerAbove(popover.firstElementChild as HTMLElement, page)).toBe(false);
    expect(inLayerAbove(list.firstElementChild as HTMLElement, popover)).toBe(false);   /* below is not above */
    b(); a();
  });

  it('tells two panels mounted in one container apart', () => {
    const host = html('<div id="a"><button id="x">x</button></div><div id="b"><button id="y">y</button></div>');
    const a = host.querySelector('#a') as HTMLElement, b = host.querySelector('#b') as HTMLElement;
    const tabA = vi.fn(() => true), tabB = vi.fn(() => true);
    const popA = pushLayer(() => {}, false, a, { inert: false, tab: tabA }), popB = pushLayer(() => {}, false, b, { inert: false, tab: tabB });
    expect(inLayerAbove(a, a.querySelector('#x'))).toBe(false);   /* its own content, not the layer above's */
    expect(inLayerAbove(a, b.querySelector('#y'))).toBe(true);
    tabFrom(a.querySelector('#x') as HTMLElement);
    expect(tabA).toHaveBeenCalled(); expect(tabB).not.toHaveBeenCalled();
    popB(); popA();
  });

  it('Escape that ends an IME composition does not close the top layer', () => {
    const esc = vi.fn();
    const pop = pushLayer(esc, false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 229 } as KeyboardEventInit));
    expect(esc).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(esc).toHaveBeenCalledTimes(1);
    pop();
  });

  it('a modal hides an app that holds a live region; a live region or the toaster at the top of <body> stays', () => {
    const app = html('<main><span aria-live="polite"></span></main>');
    const live = html(''); live.setAttribute('aria-live', 'polite');
    const toasts = html('<div class="sg-toaster"></div>'); toasts.className = 'sg-portal sg-portal--toasts';
    const dialog = html('<div role="dialog"></div>');
    const pop = pushLayer(() => {}, true, dialog.firstElementChild as HTMLElement);
    expect(app.getAttribute('aria-hidden')).toBe('true');
    expect(live.hasAttribute('aria-hidden')).toBe(false);
    expect(toasts.hasAttribute('aria-hidden')).toBe(false);
    expect(dialog.hasAttribute('aria-hidden')).toBe(false);
    pop();
    expect(app.hasAttribute('aria-hidden')).toBe(false);
  });
});
