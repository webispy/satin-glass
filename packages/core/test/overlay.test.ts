import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { focusables, trapFocus, pushLayer, inLayerAbove, tabFrom, createLayerOrder, setLayerOrder, asNewOpening } from '../src';

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

  /* a layer set aside while its overlay is hidden (Suspense): it keeps its place but locks, hides, takes and holds
     nothing, so the shown layers around it work as if it were not there; brought back, it is where it was (#79) */
  it('a paused layer keeps its place and does nothing until it is resumed', () => {
    const host = html('<div id="a"><button id="x">x</button></div><div id="b"><button id="y">y</button></div>');
    const app = document.createElement('main'); document.body.append(app);
    const a = host.querySelector('#a') as HTMLElement, b = host.querySelector('#b') as HTMLElement;
    const escA = vi.fn(), escB = vi.fn(), tabB = vi.fn(() => true);
    const popA = pushLayer(escA, true, a), popB = pushLayer(escB, true, b, { tab: tabB });
    expect(document.body.style.overflow).toBe('hidden');
    popB.pause(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(escB).not.toHaveBeenCalled(); expect(escA).toHaveBeenCalledTimes(1);   /* the shown one below takes it */
    expect(inLayerAbove(a, b.querySelector('#y'))).toBe(false);   /* it holds nothing while paused */
    expect(tabFrom(b.querySelector('#y') as HTMLElement)).toBe(false); expect(tabB).not.toHaveBeenCalled();
    popA.pause(true);
    expect(document.body.style.overflow).toBe('');
    expect(app.getAttribute('aria-hidden')).toBeNull();
    popA.pause(false); popB.pause(false);
    expect(document.body.style.overflow).toBe('hidden');
    expect(app.getAttribute('aria-hidden')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(escB).toHaveBeenCalledTimes(1);   /* back on top, where it was */
    popB(); popA(); app.remove();
    expect(document.body.style.overflow).toBe('');
    expect(app.getAttribute('aria-hidden')).toBeNull();
  });
  it('a trap resumed takes the focus back, itself when nothing in it can', () => {
    const root = html('<div id="t"><button id="in">in</button></div><button id="out">out</button>');
    const t = root.querySelector('#t') as HTMLElement;
    const pop = pushLayer(() => {}, true, t);
    const trap = trapFocus(t);
    (root.querySelector('#out') as HTMLElement).focus();
    trap.resume();
    expect(document.activeElement).toBe(root.querySelector('#in'));
    root.querySelector('#in')!.remove();
    (root.querySelector('#out') as HTMLElement).focus();
    trap.resume();
    expect(document.activeElement).toBe(t);
    trap(); pop();
  });
  it('a trap resumed passes over a control that no longer takes the focus', () => {
    const root = html('<div id="t"><button id="a" data-autofocus>a</button><button id="b">b</button></div><button id="out">out</button>');
    const t = root.querySelector('#t') as HTMLElement, a = root.querySelector('#a') as HTMLButtonElement;
    const pop = pushLayer(() => {}, true, t);
    const trap = trapFocus(t);
    expect(document.activeElement).toBe(a);
    a.disabled = true;   /* disabled while hidden */
    (root.querySelector('#out') as HTMLElement).focus();
    trap.resume();
    expect(document.activeElement).toBe(root.querySelector('#b'));
    trap(); pop();
  });
  it('a trap resumed under a modal opened above it meanwhile leaves the focus to that one', () => {
    const root = html('<div id="t"><button id="in">in</button></div><div id="m"><button id="top">top</button></div>');
    const t = root.querySelector('#t') as HTMLElement, m = root.querySelector('#m') as HTMLElement;
    const pop = pushLayer(() => {}, true, t);
    const trap = trapFocus(t);
    pop.pause(true);
    const popM = pushLayer(() => {}, true, m);   /* opened while the first was hidden */
    (document.activeElement as HTMLElement | null)?.blur();
    pop.pause(false); trap.resume();
    expect(t.contains(document.activeElement)).toBe(false);
    popM(); trap(); pop();
  });
  it('a trap set up before its layer is still left out of Tab while that layer is paused', () => {
    const root = html('<div id="t"><button id="x">x</button><button id="y">y</button></div>');
    const t = root.querySelector('#t') as HTMLElement;
    const trap = trapFocus(t);
    const pop = pushLayer(() => {}, true, t);
    pop.pause(true);
    expect(tabFrom(root.querySelector('#x') as HTMLElement)).toBe(false);
    pop.pause(false);
    expect(tabFrom(root.querySelector('#x') as HTMLElement)).toBe(true);
    pop(); trap();
  });
  it('a paused layer beside a trap in the same portal leaves the trap taking Tab', () => {
    const host = html('<div id="s"><button>s</button></div><div id="t"><button id="x">x</button><button id="y">y</button></div>');
    const s = host.querySelector('#s') as HTMLElement, t = host.querySelector('#t') as HTMLElement;
    const popS = pushLayer(() => {}, false, s, { inert: false });
    const trap = trapFocus(t);
    popS.pause(true);
    expect(tabFrom(host.querySelector('#x') as HTMLElement)).toBe(true);
    trap(); popS();
  });
  it('a trap belongs to the nearest layer holding it, whichever was pushed last', () => {
    const host = html('<div id="o"><div id="i"><div id="t"><button id="x">x</button><button id="y">y</button></div></div></div>');
    const o = host.querySelector('#o') as HTMLElement, i = host.querySelector('#i') as HTMLElement, t = host.querySelector('#t') as HTMLElement;
    const popI = pushLayer(() => {}, false, i, { inert: false });
    const popO = pushLayer(() => {}, false, o, { inert: false });   /* the outer one pushed after */
    const trap = trapFocus(t);
    popI.pause(true);
    expect(tabFrom(host.querySelector('#x') as HTMLElement)).toBe(false);
    trap(); popO(); popI();
  });
  it('a paused layer inside a trap leaves the trap taking Tab', () => {
    /* a core user's inline (not portalled) panel inside a dialog, set aside while the dialog stays shown */
    const root = html('<div id="t"><button id="x">x</button><div id="c"><button id="y">y</button></div><button id="z">z</button></div>');
    const t = root.querySelector('#t') as HTMLElement, c = root.querySelector('#c') as HTMLElement;
    const pop = pushLayer(() => {}, true, t);
    const trap = trapFocus(t);
    const popC = pushLayer(() => {}, false, c, { inert: false });
    popC.pause(true);
    expect(tabFrom(root.querySelector('#x') as HTMLElement)).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('#y'));
    popC(); trap(); pop();
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

/* the order of layers by their openings (#104): an overlay opened inside another is above it whatever the order its
   layers register in, unrelated ones keep the order they were opened in, and a layer set aside and pushed again
   comes back to its place */
describe('layer order', () => {
  const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  it('puts a child above its parent when the child registers first, and keeps unrelated openings in order', () => {
    const got: string[] = [];
    const a = createLayerOrder(), a1 = createLayerOrder(a), a2 = createLayerOrder(a1), b = createLayerOrder();
    const host = (o: ReturnType<typeof createLayerOrder>) => { const h = document.createElement('div'); document.body.appendChild(h); setLayerOrder(h, o); const el = document.createElement('div'); h.appendChild(el); return el; };
    /* the grandchild, then its parent, then the root register (React connects children first) */
    const pa2 = pushLayer(() => got.push('a2'), false, host(a2));
    const pa1 = pushLayer(() => got.push('a1'), false, host(a1));
    const pa = pushLayer(() => got.push('a'), true, host(a));
    const pb = pushLayer(() => got.push('b'), true, null, { order: b });   /* opened after: on top */
    esc(); pb();
    esc(); pa2();
    esc(); pa1();
    esc(); pa();
    expect(got).toEqual(['b', 'a2', 'a1', 'a']);
  });
  it('brings a layer pushed again for the same opening back to its place, under one opened since', () => {
    const got: string[] = [];
    const a = createLayerOrder(), a1 = createLayerOrder(a);
    let pa = pushLayer(() => got.push('a'), true, null, { order: a });
    let pa1 = pushLayer(() => got.push('a1'), true, null, { order: a1 });
    pa1(); pa();   /* both taken down (an Activity hiding them) */
    const pc = pushLayer(() => got.push('c'), true);   /* an unrelated one opened meanwhile, without an order */
    pa1 = pushLayer(() => got.push('a1'), true, null, { order: a1 });   /* shown again, child first */
    pa = pushLayer(() => got.push('a'), true, null, { order: a });
    esc(); pc(); esc(); pa1(); esc(); pa();
    expect(got).toEqual(['c', 'a1', 'a']);
  });
  it('keeps the order layers are pushed in when none is given', () => {
    const got: string[] = [];
    const p1 = pushLayer(() => got.push('1'), false), p2 = pushLayer(() => got.push('2'), false);
    esc(); p2(); esc(); p1();
    expect(got).toEqual(['2', '1']);
  });
  it('keeps <body> in stack order, moving the lower portal, when a portal learns its order late', () => {
    document.body.innerHTML = '';
    const mk = () => { const h = document.createElement('div'); h.className = 'p'; document.body.appendChild(h); const el = document.createElement('div'); h.appendChild(el); return { h, el }; };
    const c = mk(), a = mk(), b = mk();   /* <body>: C A B */
    const oa = createLayerOrder(), ob = createLayerOrder(), oc = createLayerOrder();
    setLayerOrder(a.h, oa); const pa = pushLayer(() => {}, false, a.el);
    setLayerOrder(b.h, ob); const pb = pushLayer(() => {}, false, b.el);
    const pc = pushLayer(() => {}, false, c.el);   /* pushed before its portal has its order */
    setLayerOrder(c.h, oc);
    expect([...document.body.children]).toEqual([a.h, b.h, c.h]);
    pc(); pb(); pa();
  });
  it('keeps the focus inside a portal it moves', () => {
    document.body.innerHTML = '';
    const top = document.createElement('div'), under = document.createElement('div');
    document.body.append(top, under);   /* in the wrong order: the upper one first */
    const input = document.createElement('input'); under.appendChild(input);   /* in the one that moves */
    const oUnder = createLayerOrder(), oTop = createLayerOrder(oUnder);
    setLayerOrder(top, oTop); setLayerOrder(under, oUnder);
    const pTop = pushLayer(() => {}, false, top);
    input.focus();
    const pUnder = pushLayer(() => {}, false, input);   /* the lower one moves in front */
    expect([...document.body.children]).toEqual([under, top]);
    expect(document.activeElement).toBe(input);
    pUnder(); pTop();
  });
  /* traps set up inner first (both open at once): closing them in either order ends on the page's opener, through each
     one still open */
  const nest = (n: number) => {
    document.body.innerHTML = '';
    const page = document.createElement('button'); page.textContent = 'page'; document.body.appendChild(page); page.focus();
    const orders: ReturnType<typeof createLayerOrder>[] = [];
    for (let i = 0; i < n; i++) orders.push(createLayerOrder(orders[i - 1] ?? null));
    const els = orders.map((o, i) => { const h = document.createElement('div'); document.body.appendChild(h); setLayerOrder(h, o); const el = document.createElement('div'); el.innerHTML = `<button>b${i}</button>`; h.appendChild(el); return el; });
    const layers: { pop: () => void; rel: () => void }[] = [];
    for (let i = n - 1; i >= 0; i--) { const pop = pushLayer(() => {}, true, els[i]); const rel = trapFocus(els[i]); layers[i] = { pop, rel }; }
    return { page, els, layers };
  };
  const close = (l: { pop: () => void; rel: () => void }, el: HTMLElement) => { l.pop(); l.rel(); el.parentElement!.remove(); };
  it('inner first, closed inner first: the focus goes to the outer one, then to the page', () => {
    const { page, els, layers } = nest(2);
    expect(document.activeElement?.textContent).toBe('b1');
    close(layers[1], els[1]); expect(document.activeElement?.textContent).toBe('b0');
    close(layers[0], els[0]); expect(document.activeElement).toBe(page);
  });
  it('inner first, closed outer first: the inner one gives the focus to the page', () => {
    const { page, els, layers } = nest(2);
    close(layers[0], els[0]);
    close(layers[1], els[1]); expect(document.activeElement).toBe(page);
  });
  it('three, inner first: each closing hands the focus to the one under it', () => {
    const { page, els, layers } = nest(3);
    expect(document.activeElement?.textContent).toBe('b2');
    close(layers[2], els[2]); expect(document.activeElement?.textContent).toBe('b1');
    close(layers[1], els[1]); expect(document.activeElement?.textContent).toBe('b0');
    close(layers[0], els[0]); expect(document.activeElement).toBe(page);
  });
  it('a child pushed again after its parent was renewed comes back above it', () => {
    const got: string[] = [];
    const a = createLayerOrder(), b = createLayerOrder(a), c = createLayerOrder(b);
    let pc = pushLayer(() => got.push('c'), false, null, { order: c });   /* reserves a and b */
    pc();   /* c taken down (hidden) */
    const pa = asNewOpening(() => pushLayer(() => got.push('a'), false, null, { order: a }));   /* a re-opened */
    const pb = pushLayer(() => got.push('b'), false, null, { order: b });
    pc = pushLayer(() => got.push('c'), false, null, { order: c });
    const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    esc(); pc(); esc(); pb(); esc(); pa();
    expect(got).toEqual(['c', 'b', 'a']);
  });
  it('three, inner first, the middle one closed first: the inner one then gives the focus to the outer one', () => {
    const { page, els, layers } = nest(3);
    close(layers[1], els[1]);
    close(layers[2], els[2]); expect(document.activeElement?.textContent).toBe('b0');
    close(layers[0], els[0]); expect(document.activeElement).toBe(page);
  });
  it('a layer re-opened in an asNewOpening inside another is a new opening too', () => {
    const got: string[] = [];
    const a = createLayerOrder(), b = createLayerOrder();
    let pa = pushLayer(() => got.push('a'), false, null, { order: a }); pa();
    const pc = pushLayer(() => got.push('c'), false);   /* opened meanwhile */
    asNewOpening(() => { asNewOpening(() => {}); pa = pushLayer(() => got.push('a'), false, null, { order: a }); });
    const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    esc(); pa(); esc(); pc(); void b;
    expect(got).toEqual(['a', 'c']);
  });
});
