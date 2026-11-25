import { StrictMode, useLayoutEffect, useRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@satin-glass/react';
import { A2uiSurfaces, useA2ui, type A2uiReport, type A2uiSession } from '../src';
import { a11y, components, create, data, frame, mount, path, remove, tick, type V } from './helpers';
import { markTrustedGesture } from '../src/urls';
import { safePattern } from '../src/patterns';
import { against } from '../src/components/inputs';

it('keeps what it processed during StrictMode\'s first setup through the trial unmount', async () => {
  const reports: A2uiReport[] = [];
  function App() {
    const a2ui = useA2ui({ onReport: (r) => reports.push(r) });
    const fed = useRef(false);
    /* an app that feeds each message once, from its first layout effect */
    useLayoutEffect(() => { if (fed.current) return; fed.current = true; a2ui.process([create('1.0'), components('1.0', [{ id: 'root', component: 'Text', text: 'Still here' }])]); }, [a2ui]);
    return <A2uiSurfaces a2ui={a2ui} />;
  }
  render(<StrictMode><ThemeProvider><App /></ThemeProvider></StrictMode>);
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });   // past the tick a real unmount would wait
  expect(screen.getByText('Still here')).toBeTruthy();
  expect(reports).toEqual([]);
});

it('keeps the same session object across renders, and ends it on unmount without throwing', async () => {
  const seen: A2uiSession[] = [];
  const reports: A2uiReport[] = [];
  function App({ n }: { n: number }) { const a2ui = useA2ui({ onReport: (r) => reports.push(r) }); seen.push(a2ui); return <A2uiSurfaces a2ui={a2ui} key={n} />; }
  const r = render(<ThemeProvider><App n={1} /></ThemeProvider>);
  r.rerender(<ThemeProvider><App n={2} /></ThemeProvider>);
  expect(seen[0]).toBe(seen[seen.length - 1]);
  expect(seen[0].process).toBe(seen[seen.length - 1].process);
  r.unmount();
  await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
  expect(() => seen[0].process([create('1.0')])).not.toThrow();
  expect(reports.some((x) => x.kind === 'input' && /after the session ended/.test(x.message))).toBe(true);
});

it('reports an error from a message processed before any effect ran', () => {
  const reports: A2uiReport[] = [];
  function Child({ a2ui }: { a2ui: A2uiSession }) {
    useLayoutEffect(() => { a2ui.process([components('1.0', [{ id: 'root', component: 'Text', text: 'x' }], 'nowhere')]); }, [a2ui]);
    return null;
  }
  function App() { const a2ui = useA2ui({ onReport: (r) => reports.push(r) }); return <><Child a2ui={a2ui} /><A2uiSurfaces a2ui={a2ui} /></>; }
  render(<ThemeProvider><App /></ThemeProvider>);
  expect(reports.some((r) => r.kind === 'error')).toBe(true);
});

it('applies the good envelopes of a batch with a bad one in the middle', () => {
  const reports: A2uiReport[] = [];
  const { session } = mount({ onReport: (r) => reports.push(r) });
  act(() => session().process([create('1.0'), { version: '1.0', updateComponents: { surfaceId: 's', components: 'not a list' } }, components('1.0', [{ id: 'root', component: 'Text', text: 'Applied' }])]));
  expect(screen.getByText('Applied')).toBeTruthy();
  expect(reports.some((r) => r.kind === 'error')).toBe(true);
});

it('advertises each protocol version with its own catalog only', () => {
  const { session } = mount();
  expect(session().capabilities()).toEqual({
    '1.0': { supportedCatalogIds: ['https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'] },
    'v0.9': { supportedCatalogIds: ['https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'] },
  });
});

it('sends nothing more from a session that was reset', async () => {
  const sent: unknown[] = [];
  const { session } = mount({ onOutbound: (m) => { sent.push(m); } });
  const old = session().processor;
  act(() => session().reset());
  old.processMessages([components('1.0', [{ id: 'root', component: 'Text', text: 'x' }], 'nowhere')] as never);
  await act(async () => { await Promise.resolve(); });
  expect(sent).toEqual([]);
});

it('refuses an agent pattern that could stall the page, and reports it', () => {
  const reports: A2uiReport[] = [];
  const { feed } = mount({ onReport: (r) => reports.push(r) });
  feed(create('0.9'), data('0.9', { code: 'aaa!' }), components('0.9', [{ id: 'root', component: 'TextField', label: 'Code', value: path('0.9', '/code'), validationRegexp: '^(a+)+$' }]));
  expect(screen.getByRole('textbox', { name: 'Code' })).toBeTruthy();
  expect(reports.some((r) => r.kind === 'diagnostic' && r.code === 'refused-pattern')).toBe(true);
});

it('resolves a relative media URL against the document\'s base, and uses the URL the policy saw', () => {
  const b = document.createElement('base'); b.href = 'https://cdn.example/assets/'; document.head.append(b);
  try {
    const seen: string[] = [];
    const { feed, container } = mount({ allowUrl: (u) => { seen.push(u.href); return u.hostname === 'cdn.example'; } });
    feed(create('1.0'), components('1.0', [{ id: 'root', component: 'Image', url: 'photo.png', description: 'P' }]));
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/assets/photo.png');
    expect(seen).toContain('https://cdn.example/assets/photo.png');
  } finally { b.remove(); }
});

it('does not open a URL when the browser says no gesture is live', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  Object.defineProperty(navigator, 'userActivation', { value: { isActive: false }, configurable: true });
  try {
    const { feed } = mount({ onReport: () => {} });
    feed(create('1.0'), components('1.0', [{ id: 'root', component: 'Button', child: 't', action: { functionCall: { '@call': 'openUrl', args: { url: 'https://x.example' } } } }, { id: 't', component: 'Text', text: 'Go' }]));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Go' })); await Promise.resolve(); });
    expect(open).not.toHaveBeenCalled();
  } finally { delete (navigator as { userActivation?: unknown }).userActivation; open.mockRestore(); }
});

it('moves a fractional slider by its steps and writes the snapped value', () => {
  const { feed, session } = mount();
  feed(create('1.0'), data('1.0', { r: 0 }), components('1.0', [{ id: 'root', component: 'Slider', label: 'Ratio', min: 0, max: 1, steps: 4, value: path('1.0', '/r') }]));
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Ratio' }), { key: 'ArrowRight' });
  expect((session().dataModel('1.0') as { surfaces: Record<string, { r: number }> }).surfaces.s.r).toBe(0.25);
});

it('shows a checkbox\'s check message once it has been left', async () => {
  const { feed } = mount();
  feed(create('1.0'), data('1.0', { ok: false }), components('1.0', [{ id: 'root', component: 'CheckBox', label: 'I agree', value: path('1.0', '/ok'),
    '@checks': [{ condition: path('1.0', '/ok'), message: 'Agree to go on.' }] }]));
  const box = screen.getByRole('checkbox', { name: 'I agree' });
  expect(screen.queryByText('Agree to go on.')).toBeNull();
  act(() => box.focus()); act(() => box.blur());
  await tick();
  expect(screen.getByText('Agree to go on.')).toBeTruthy();
  expect(box.getAttribute('aria-invalid')).toBe('true');
});

it('keeps the session, and what the user typed, when the language changes', () => {
  const { feed, rerenderWith } = mount({}, 'en');
  feed(create('1.0'), data('1.0', { n: '' }), components('1.0', [{ id: 'root', component: 'TextField', label: 'Name', value: path('1.0', '/n') }]));
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'typed' } });
  rerenderWith({}, 'ko');
  expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('typed');
  expect(screen.getByRole('region', { name: '에이전트 콘텐츠' })).toBeTruthy();
});

describe.each<V>(['1.0', '0.9'])('v%s', (v) => {
  it('opens a URL through the app\'s policy, and only on a user\'s action', async () => {
    const opened: string[] = [];
    const open = vi.spyOn(window, 'open').mockImplementation((u) => { opened.push(String(u)); return null; });
    const reports: A2uiReport[] = [];
    const { feed } = mount({ allowUrl: (u) => u.hostname === 'ok.example', onReport: (r) => reports.push(r) });
    const fn = (url: string) => (v === '1.0' ? { functionCall: { '@call': 'openUrl', args: { url } } } : { functionCall: { call: 'openUrl', args: { url } } });
    feed(create(v), components(v, [
      { id: 'root', component: 'Row', children: ['a', 'b'] },
      { id: 'a', component: 'Button', child: 'at', action: fn('https://ok.example/x') }, { id: 'at', component: 'Text', text: 'Allowed' },
      { id: 'b', component: 'Button', child: 'bt', action: fn('https://evil.example/x') }, { id: 'bt', component: 'Text', text: 'Refused' },
    ]));
    /* a script's click (not trusted) opens nothing, even for an allowed URL */
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Allowed' })); await Promise.resolve(); });
    expect(opened).toEqual([]);
    /* a trusted press (marked as the button does for a real click) opens an allowed URL, once */
    await act(async () => { markTrustedGesture(); fireEvent.click(screen.getByRole('button', { name: 'Allowed' })); await Promise.resolve(); });
    await act(async () => { markTrustedGesture(); fireEvent.click(screen.getByRole('button', { name: 'Refused' })); await Promise.resolve(); });
    expect(opened).toEqual(['https://ok.example/x']);
    open.mockRestore();
  });

  it('opens a modal as a Satin dialog titled with its label, and gives focus back to the trigger', async () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Modal', trigger: 'open', content: 'body', ...a11y(v, 'Rules') },
      { id: 'open', component: 'Button', child: 'ot', action: { event: { name: 'opened' } } }, { id: 'ot', component: 'Text', text: 'Show rules' },
      { id: 'body', component: 'Text', text: 'No surprises.' },
    ]));
    const trigger = screen.getByRole('button', { name: 'Show rules' });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Rules' });
    expect(dialog.textContent).toMatch('No surprises.');
    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(screen.queryByRole('dialog', { name: 'Rules' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('wraps a trigger that cannot take focus in a button', () => {
    const { feed } = mount({ onReport: () => {} });
    feed(create(v), components(v, [{ id: 'root', component: 'Modal', trigger: 't', content: 'c' }, { id: 't', component: 'Text', text: 'More' }, { id: 'c', component: 'Text', text: 'Body' }]));
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('writes one ISO value from a date and a time, keeping what was not touched, and refuses one out of range', () => {
    const { feed, session } = mount();
    feed(create(v), data(v, { when: '2026-11-25T09:30:15+09:00' }),
      components(v, [{ id: 'root', component: 'DateTimeInput', label: 'When', enableDate: true, enableTime: true, value: path(v, '/when'), min: '2026-11-01', max: '2026-11-30T23:59' }]));
    expect(screen.getByRole('group', { name: 'When' })).toBeTruthy();
    expect(screen.getAllByText(/Time/).length).toBeGreaterThan(0);
    const when = () => (session().dataModel(v) as { surfaces: Record<string, { when: string }> }).surfaces.s.when;
    expect(when()).toBe('2026-11-25T09:30:15+09:00');
  });

  it('renders Markdown text without HTML: tags stay text, links keep their words only', () => {
    const { feed, container } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'Text', text: '**Bold** <img src=x onerror=alert(1)> and [a link](https://x.example)' }]));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.querySelector('strong')?.textContent).toBe('Bold');
  });

  it('keeps list semantics for List', () => {
    const { feed } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'List', children: ['a', 'b'] }, { id: 'a', component: 'Text', text: 'One' }, { id: 'b', component: 'Text', text: 'Two' }]));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

it('checks v0.9.1\'s validationRegexp after the field is left', async () => {
  const { feed } = mount();
  feed(create('0.9'), data('0.9', { code: '' }), components('0.9', [{ id: 'root', component: 'TextField', label: 'Code', value: path('0.9', '/code'), validationRegexp: '^[0-9]{4}$' }]));
  const field = screen.getByRole('textbox', { name: 'Code' });
  fireEvent.change(field, { target: { value: '12a' } });
  fireEvent.blur(field);
  await tick();
  expect(screen.getByText('Check the format.')).toBeTruthy();
  fireEvent.change(field, { target: { value: '1234' } });
  expect(screen.queryByText('Check the format.')).toBeNull();
});

it('a v1.0 placeholder and a fractional slider without steps', () => {
  const { feed, session } = mount();
  feed(create('1.0'), data('1.0', { r: 0.5 }), components('1.0', [
    { id: 'root', component: 'Column', children: ['f', 's'] },
    { id: 'f', component: 'TextField', label: 'Note', placeholder: 'Say something', value: path('1.0', '/x') },
    { id: 's', component: 'Slider', label: 'Ratio', min: 0, max: 1, value: path('1.0', '/r') },
  ]));
  expect(screen.getByPlaceholderText('Say something')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Ratio' }), { key: 'ArrowRight' });
  expect((session().dataModel('1.0') as { surfaces: Record<string, { r: number }> }).surfaces.s.r).toBeCloseTo(0.51, 5);
});

it('names a ThemeProvider-less app\'s region in English', () => {
  function App() { const a2ui = useA2ui(); return <A2uiSurfaces a2ui={a2ui} />; }
  render(<App />);
  expect(screen.getByRole('region', { name: 'Agent content' })).toBeTruthy();
});

it('feeds the new session when process() follows reset() in the same render', () => {
  const box: { a2ui?: A2uiSession } = {};
  function App() { const a2ui = useA2ui(); box.a2ui = a2ui; return <A2uiSurfaces a2ui={a2ui} />; }
  render(<ThemeProvider><App /></ThemeProvider>);
  act(() => box.a2ui!.process([create('1.0', 'old'), components('1.0', [{ id: 'root', component: 'Text', text: 'Old' }], 'old')]));
  act(() => { const a = box.a2ui!; a.reset(); a.process([create('1.0', 'new'), components('1.0', [{ id: 'root', component: 'Text', text: 'New' }], 'new')]); });
  expect(screen.queryByText('Old')).toBeNull();
  expect(screen.getByText('New')).toBeTruthy();
});

describe('DateTimeInput bounds', () => {
  it('compares values with an offset as instants', () => {
    /* 11:00 at +02:00 is 09:00Z: within a 10:00Z maximum, though it sorts above it as text */
    expect(against('2026-11-25T11:00:00+02:00', '2026-11-25T10:00:00Z', false)).toBe(false);
    /* 09:00 at +02:00 is 07:00Z: below an 08:30Z minimum, though it sorts above it as text */
    expect(against('2026-11-25T09:00:00+02:00', '2026-11-25T08:30:00Z', true)).toBe(true);
  });
  it('compares local values as text of the bound\'s length (a date bound for a date and time)', () => {
    expect(against('2026-11-30T23:00', '2026-11-30', false)).toBe(false);
    expect(against('2026-12-01T00:00', '2026-11-30', false)).toBe(true);
    expect(against('2026-10-31', '2026-11-01', true)).toBe(true);
  });
});

describe('agent patterns run only with bounded work', () => {
  it.each(['^[0-9]{4}$', '^[^@\\s]+@[^@\\s]+$', '^\\+?\\d{1,3}[-\\s]?\\d{3,4}[-\\s]?\\d{4}$', '^(ab|cd)$', '^(?:-)?\\d+$', 'colou?r'])('accepts %s', (p) => {
    expect(safePattern(p)).toBeInstanceOf(RegExp);
  });
  it.each(['^(a+)+$', '^(a|a)*$', '^(a{1,10}){1,10}$', '^\\w*\\w*\\w*$', '(a)\\1', '(?=a)a', '(?<!a)b', '^a{1,40}b{1,40}$', '('])('refuses %s', (p) => {
    expect(safePattern(p)).toBeNull();
  });
});

describe('the session at its edges', () => {
  it('refuses an internal operation and a wrapper, and goes on after a message that cannot be copied', () => {
    const reports: A2uiReport[] = [];
    const { session } = mount({ onReport: (r) => reports.push(r) });
    act(() => session().process([
      create('1.0'),
      { version: '1.0', type: 'deleteSurface', surfaceId: 's' },
      { version: '1.0', messages: [] },
      { version: '1.0', updateDataModel: { surfaceId: 's', value: { f: () => 1 } } },
      components('1.0', [{ id: 'root', component: 'Text', text: 'Still drawn' }]),
    ]));
    expect(screen.getByText('Still drawn')).toBeTruthy();
    expect(reports.filter((r) => r.kind === 'input')).toHaveLength(3);
  });
  it('keeps the session when the same versions come in another order', () => {
    const box: { a2ui?: A2uiSession } = {};
    function App({ v }: { v: ('1.0' | '0.9')[] }) { const a2ui = useA2ui({ versions: v }); box.a2ui = a2ui; return <A2uiSurfaces a2ui={a2ui} />; }
    const r = render(<ThemeProvider><App v={['1.0', '0.9']} /></ThemeProvider>);
    act(() => box.a2ui!.process([create('1.0'), components('1.0', [{ id: 'root', component: 'Text', text: 'Kept' }])]));
    const proc = box.a2ui!.processor;
    r.rerender(<ThemeProvider><App v={['0.9', '1.0']} /></ThemeProvider>);
    expect(box.a2ui!.processor).toBe(proc);
    expect(screen.getByText('Kept')).toBeTruthy();
  });
  it('takes nothing in and sends nothing once its component has unmounted, and a later reset() does nothing', async () => {
    const sent: unknown[] = [];
    const reports: A2uiReport[] = [];
    const box: { a2ui?: A2uiSession } = {};
    function App() { const a2ui = useA2ui({ onOutbound: (m) => { sent.push(m); }, onReport: (r) => reports.push(r) }); box.a2ui = a2ui; return <A2uiSurfaces a2ui={a2ui} />; }
    const r = render(<ThemeProvider><App /></ThemeProvider>);
    const a2ui = box.a2ui!;
    r.unmount();
    a2ui.process([components('1.0', [{ id: 'root', component: 'Text', text: 'x' }], 'nowhere')]);   // in the same tick
    await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
    const before = a2ui.processor;
    a2ui.reset();
    expect(a2ui.processor).toBe(before);
    expect(sent).toEqual([]);
    expect(reports.filter((x) => x.kind === 'input')).toHaveLength(2);
  });
  it('retires every session a double reset replaces', () => {
    const { session } = mount();
    const first = session().processor;
    act(() => { session().reset(); session().reset(); });
    const dispose = vi.spyOn(first, 'dispose');
    expect(session().processor).not.toBe(first);
    expect(dispose).not.toHaveBeenCalled();   // already retired: it was disposed when replaced
  });
  it('shows its surfaces in a memoised consumer of the session', async () => {
    const { MemoSurfaces } = await import('./memo');
    const box: { a2ui?: A2uiSession } = {};
    function App() { const a2ui = useA2ui(); box.a2ui = a2ui; return <MemoSurfaces a2ui={a2ui} />; }
    render(<ThemeProvider><App /></ThemeProvider>);
    act(() => box.a2ui!.process([create('1.0'), components('1.0', [{ id: 'root', component: 'Text', text: 'Through memo' }])]));
    expect(screen.getByText('Through memo')).toBeTruthy();
  });
});

describe('focus after deletion', () => {
  it('leaves the page alone when the user had blurred the field before the surface was deleted', async () => {
    const { feed } = mount();
    feed(create('1.0'), data('1.0', { n: '' }), components('1.0', [{ id: 'root', component: 'TextField', label: 'Name', value: path('1.0', '/n') }]));
    const field = screen.getByRole('textbox', { name: 'Name' });
    act(() => field.focus()); act(() => field.blur());
    await act(async () => { await Promise.resolve(); });
    feed(remove('1.0'));
    await frame();
    expect(document.activeElement).toBe(document.body);
  });
  it('takes the focus to the region when the surface is deleted with its dialog open', async () => {
    const { feed } = mount();
    feed(create('1.0'), components('1.0', [
      { id: 'root', component: 'Modal', trigger: 'open', content: 'body', '@accessibility': { label: 'Rules' } },
      { id: 'open', component: 'Button', child: 'ot', action: { event: { name: 'o' } } }, { id: 'ot', component: 'Text', text: 'Show' },
      { id: 'body', component: 'Text', text: 'Inside' },
    ]));
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rules' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    feed(remove('1.0'));
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    await frame();
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Agent content' }));
  });
});

describe('modal triggers', () => {
  it('makes an image trigger a button, and leaves one that already holds a control alone', () => {
    const { feed } = mount({ onReport: () => {} });
    feed(create('1.0'), components('1.0', [
      { id: 'root', component: 'Column', children: ['m1', 'm2'] },
      { id: 'm1', component: 'Modal', trigger: 'pic', content: 'c' },
      { id: 'pic', component: 'Image', url: 'https://img.example/a.png', description: 'Floor plan' },
      { id: 'm2', component: 'Modal', trigger: 'row', content: 'c' },
      { id: 'row', component: 'Row', children: ['b'] }, { id: 'b', component: 'Button', child: 'bt', action: { event: { name: 'x' } } }, { id: 'bt', component: 'Text', text: 'Open' },
      { id: 'c', component: 'Text', text: 'Content' },
    ]));
    expect(screen.getByRole('button', { name: 'Floor plan' })).toBeTruthy();
    const open = screen.getByRole('button', { name: 'Open' });
    expect(open.parentElement?.closest('[role=button]')).toBeNull();   // not a button inside a button
  });
  it('follows a trigger streamed in after the modal, and opens on Enter', async () => {
    const { feed } = mount({ onReport: () => {} });
    feed(create('1.0'), components('1.0', [{ id: 'root', component: 'Modal', trigger: 't', content: 'c', '@accessibility': { label: 'More' } }, { id: 'c', component: 'Text', text: 'Content' }]));
    feed(components('1.0', [{ id: 't', component: 'Text', text: 'Read more' }]));
    const trigger = await screen.findByRole('button', { name: 'Read more' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(await screen.findByRole('dialog', { name: 'More' })).toBeTruthy();
  });
});

describe('inputs', () => {
  it('moves a slider of a tiny range, and disables one of no width', () => {
    const { feed, session } = mount();
    feed(create('1.0'), data('1.0', { a: 0, b: 5 }), components('1.0', [
      { id: 'root', component: 'Column', children: ['s1', 's2'] },
      { id: 's1', component: 'Slider', label: 'Tiny', min: 0, max: 0.000001, steps: 10, value: path('1.0', '/a') },
      { id: 's2', component: 'Slider', label: 'Flat', min: 5, max: 5, value: path('1.0', '/b') },
    ]));
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Tiny' }), { key: 'ArrowRight' });
    expect((session().dataModel('1.0') as { surfaces: Record<string, { a: number }> }).surfaces.s.a).toBeCloseTo(0.0000001, 12);
    expect(screen.getByRole('slider', { name: 'Flat' }).getAttribute('aria-disabled')).toBe('true');
  });
  it('drops the filter when the agent turns filtering off', () => {
    const { feed } = mount();
    const picker = (filterable: boolean) => components('1.0', [{ id: 'root', component: 'ChoicePicker', label: 'Size', variant: 'multipleSelection', displayStyle: 'chips', filterable, options: [{ label: 'Small', value: 'a' }, { label: 'Large', value: 'c' }], value: path('1.0', '/p') }]);
    feed(create('1.0'), data('1.0', { p: [] }), picker(true));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lar' } });
    expect(screen.queryByText('Small')).toBeNull();
    feed(picker(false));
    expect(screen.getByText('Small')).toBeTruthy();
  });
  it('compares times of either precision alike', () => {
    expect(against('09:30', '09:30:00', true)).toBe(false);
    expect(against('2026-11-25T09:29', '2026-11-25T09:30:00', true)).toBe(true);
  });
});

describe('built-in words for checks the agent gave no message', () => {
  it('shows web_core\'s own messages in the page\'s language', async () => {
    const { feed } = mount({}, 'ko');
    feed(create('1.0'), data('1.0', { n: '', code: 'x' }), components('1.0', [
      { id: 'root', component: 'Column', children: ['a', 'b', 'go'] },
      { id: 'a', component: 'TextField', label: '이름', value: path('1.0', '/n'), '@checks': [{ condition: { '@call': 'required', args: { value: path('1.0', '/n') } } }] },
      { id: 'b', component: 'TextField', label: '코드', value: path('1.0', '/code'), '@checks': [{ condition: { '@call': 'regex', args: { value: path('1.0', '/code'), pattern: '^[0-9]+$' } } }] },
      { id: 'go', component: 'Button', child: 'gt', '@checks': [{ condition: { '@call': 'required', args: { value: path('1.0', '/n') } } }], action: { event: { name: 'go' } } },
      { id: 'gt', component: 'Text', text: '보내기' },
    ]));
    for (const name of ['이름', '코드']) { const f = screen.getByRole('textbox', { name }); act(() => f.focus()); act(() => f.blur()); }
    await tick();
    expect(screen.getAllByText('입력하세요.').length).toBeGreaterThanOrEqual(2);   // the field, and the button's reason
    expect(screen.getByText('형식을 확인하세요.')).toBeTruthy();
    expect(screen.queryByText(/This field is required|does not match/)).toBeNull();
  });
  it('words a check that gives only true or false (web_core\'s "Validation failed")', async () => {
    /* v0.9.1 requires a message on every check; in v1.0 one without, on a plain condition, falls back to that */
    const { feed } = mount({}, 'ko');
    feed(create('1.0'), data('1.0', { ok: false, n: '' }), components('1.0', [{ id: 'root', component: 'TextField', label: '이름', value: path('1.0', '/n'), '@checks': [{ condition: path('1.0', '/ok') }] }]));
    const f = screen.getByRole('textbox', { name: '이름' }); act(() => f.focus()); act(() => f.blur());
    await tick();
    expect(screen.getByText('값을 확인하세요.')).toBeTruthy();
    expect(screen.queryByText('Validation failed')).toBeNull();
  });
  it('keeps a message the agent wrote as it is', async () => {
    const { feed } = mount({}, 'ko');
    feed(create('1.0'), data('1.0', { n: '' }), components('1.0', [{ id: 'root', component: 'TextField', label: '이름', value: path('1.0', '/n'), '@checks': [{ condition: { '@call': 'required', args: { value: path('1.0', '/n') } }, message: '이름을 알려 주세요.' }] }]));
    const f = screen.getByRole('textbox', { name: '이름' }); act(() => f.focus()); act(() => f.blur());
    await tick();
    expect(screen.getByText('이름을 알려 주세요.')).toBeTruthy();
  });
});

it('names a single-choice list once, and reads the agent\'s description through aria-describedby', () => {
  const { feed } = mount();
  feed(create('1.0'), data('1.0', { p: [] }), components('1.0', [
    { id: 'root', component: 'Column', children: ['c', 'b'] },
    { id: 'c', component: 'ChoicePicker', label: 'Size', variant: 'mutuallyExclusive', options: [{ label: 'S', value: 's' }, { label: 'L', value: 'l' }], value: path('1.0', '/p') },
    { id: 'b', component: 'Button', child: 'bt', '@accessibility': { label: 'Send', description: 'Sends the form to the agent' }, action: { event: { name: 'go' } } },
    { id: 'bt', component: 'Text', text: 'Send' },
  ]));
  /* Satin's radio buttons sit in a named fieldset; the group around it that carries the error takes no name */
  expect(screen.getAllByRole('group', { name: 'Size' })).toHaveLength(1);
  const b = screen.getByRole('button', { name: 'Send' });
  expect(b.getAttribute('aria-description')).toBeNull();
  expect(document.getElementById(b.getAttribute('aria-describedby')!)?.textContent).toBe('Sends the form to the agent');
});
