import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { ThemeProvider } from '@satin-glass/react';
import { A2uiProvider, A2uiSurfaces, useA2ui } from '../src';
import type { A2uiReport } from '../src';
import { a11y, call, checks, components, create, data, frame, mount, path, remove, tick, wire, type V } from './helpers';

const form = (v: V) => [
  create(v),
  data(v, { name: '', volume: 50, email: true }),
  components(v, [
    { id: 'root', component: 'Column', children: ['name', 'volume', 'email', 'save'] },
    {
      id: 'name', component: 'TextField', label: 'Name', value: path(v, '/name'),
      ...checks(v, [{ condition: call(v, 'length', { value: path(v, '/name'), min: 3 }), message: 'Use at least 3 characters.' }]),
    },
    { id: 'volume', component: 'Slider', label: 'Volume', min: 0, max: 100, value: path(v, '/volume'), ...(v === '1.0' ? { steps: 4 } : {}) },
    { id: 'email', component: 'CheckBox', label: 'Email me', value: path(v, '/email') },
    {
      id: 'save', component: 'Button', variant: 'primary', child: 'save_text',
      ...checks(v, [{ condition: call(v, 'length', { value: path(v, '/name'), min: 3 }), message: 'Fix the name first.' }]),
      action: { event: { name: 'save', context: { name: path(v, '/name'), email: path(v, '/email') } } },
    },
    { id: 'save_text', component: 'Text', text: 'Save' },
  ]),
];

describe.each<V>(['1.0', '0.9'])('protocol v%s', (v) => {
  it('binds, checks and sends exactly one versioned action with the edited values', async () => {
    const sent: unknown[] = [];
    const { feed } = mount({ onOutbound: (m) => { sent.push(m); } });
    feed(...form(v));
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    /* disabled by its checks, and it says why at once, linked to the button */
    expect(save.disabled).toBe(true);
    const why = document.getElementById(save.getAttribute('aria-describedby')!);
    expect(why?.textContent).toBe('Fix the name first.');
    const field = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'ab' } });
    expect(save.disabled).toBe(true);
    /* the field's own message shows only once the field has been left */
    expect(screen.queryByText('Use at least 3 characters.')).toBeNull();
    fireEvent.blur(field);
    await tick();
    expect(screen.getByText('Use at least 3 characters.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(field, { target: { value: 'abc' } });
    expect(save.disabled).toBe(false);
    expect(field.getAttribute('aria-invalid')).not.toBe('true');
    await act(async () => { fireEvent.click(save); await Promise.resolve(); });
    const actions = sent.filter((m) => (m as { action?: unknown }).action) as { version: string; action: { name: string; surfaceId: string; sourceComponentId: string; context: Record<string, unknown> } }[];
    expect(actions).toHaveLength(1);
    expect(actions[0].version).toBe(wire(v));
    expect(actions[0].action).toMatchObject({ name: 'save', surfaceId: 's', sourceComponentId: 'save', context: { name: 'abc', email: true } });
  });

  it('moves the slider by the version\'s step: v1.0 `steps` divides the range', () => {
    const { feed, session } = mount();
    feed(...form(v));
    const slider = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    const model = session().dataModel(v) as { surfaces: Record<string, { volume: number }> };
    expect(model.surfaces.s.volume).toBe(v === '1.0' ? 75 : 51);
  });

  it('gives a List item to a child only once it is sent', () => {
    const { feed } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'List', children: ['a', 'late', 'b'] }, { id: 'a', component: 'Text', text: 'A' }, { id: 'b', component: 'Text', text: 'B' }]));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A', 'B']);
    feed(components(v, [{ id: 'late', component: 'Text', text: 'L' }]));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A', 'L', 'B']);
  });

  it('shows a child sent later in the place it was named, and nothing before', () => {
    const { feed } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'Column', children: ['a', 'late', 'b'] }, { id: 'a', component: 'Text', text: 'A' }, { id: 'b', component: 'Text', text: 'B' }]));
    const col = screen.getByText('A').closest('.sg-stack')!;
    expect(col.textContent).toBe('AB');
    feed(components(v, [{ id: 'late', component: 'Text', text: 'L' }]));
    expect(col.textContent).toBe('ALB');
  });

  describe('accessible names', () => {
    const button = (label: string, text: string) => [
      create(v),
      components(v, [{ id: 'root', component: 'Button', child: 't', ...a11y(v, label), action: { event: { name: 'go' } } }, { id: 't', component: 'Text', text }]),
    ];
    it('takes the agent label when it holds the visible text as words', () => {
      const { feed } = mount();
      feed(...button('Save the draft now', 'Save the draft'));
      expect(screen.getByRole('button', { name: 'Save the draft now' })).toBeTruthy();
    });
    it('keeps the visible text when the label does not hold it, names the group with the label and reports it', () => {
      const reports: A2uiReport[] = [];
      const { feed } = mount({ onReport: (r) => reports.push(r) });
      feed(...button('Send form', 'Save'));
      const b = screen.getByRole('button', { name: 'Save' });
      expect(b.getAttribute('aria-label')).toBeNull();
      expect(screen.getByRole('group', { name: 'Send form' }).contains(b)).toBe(true);
      expect(reports.some((r) => r.kind === 'diagnostic' && r.code === 'label-conflict' && r.componentId === 'root' && r.surfaceId === 's')).toBe(true);
    });
    it('follows the visible text when the button\'s child text changes on its own', async () => {
      const { feed } = mount({ onReport: () => {} });
      feed(create(v), data(v, { t: 'Save' }),
        components(v, [{ id: 'root', component: 'Button', child: 't', ...a11y(v, 'Save draft'), action: { event: { name: 'go' } } }, { id: 't', component: 'Text', text: path(v, '/t') }]));
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeTruthy();
      feed(data(v, 'Delete', 's', '/t'));
      expect(await screen.findByRole('button', { name: 'Delete' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    });
    it('counts words, not characters ("3페이지" does not hold "3")', () => {
      const { feed } = mount({ onReport: () => {} });
      feed(...button('3페이지', '3'));
      expect(screen.getByRole('button', { name: '3' })).toBeTruthy();
    });
  });

  it('refuses messages of a version the session does not accept, and reports them', () => {
    const reports: A2uiReport[] = [];
    const { feed, container } = mount({ versions: [v === '1.0' ? '0.9' : '1.0'], onReport: (r) => reports.push(r) });
    feed(create(v), components(v, [{ id: 'root', component: 'Text', text: 'x' }]));
    expect(container.textContent).toBe('');
    expect(reports.filter((r) => r.kind === 'input')).toHaveLength(2);
  });

  it('draws a neutral glyph for an icon the app did not give, and reports the name once', () => {
    const reports: A2uiReport[] = [];
    const { feed, container } = mount({ onReport: (r) => reports.push(r) });
    feed(create(v), components(v, [{ id: 'root', component: 'Row', children: ['i', 'j'] }, { id: 'i', component: 'Icon', name: 'send' }, { id: 'j', component: 'Icon', name: 'send' }]));
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(reports.filter((r) => r.kind === 'diagnostic' && r.code === 'missing-icon')).toHaveLength(1);
  });

  it('draws the icon the app gave for a name', () => {
    const { feed } = mount({ icons: { send: <b data-testid="send">S</b> } });
    feed(create(v), components(v, [{ id: 'root', component: 'Icon', name: 'send' }]));
    expect(screen.getByTestId('send')).toBeTruthy();
  });

  it('refuses an image URL the policy refuses, and draws nothing', () => {
    const reports: A2uiReport[] = [];
    const { feed, container } = mount({ onReport: (r) => reports.push(r), allowUrl: (u) => u.hostname === 'ok.example' });
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['a', 'b', 'c'] },
      { id: 'a', component: 'Image', url: 'https://ok.example/a.png', description: 'A' },
      { id: 'b', component: 'Image', url: 'https://evil.example/b.png', description: 'B' },
      { id: 'c', component: 'Image', url: 'javascript:alert(1)', description: 'C' },
    ]));
    expect([...container.querySelectorAll('img')].map((i) => i.getAttribute('alt'))).toEqual(['A']);
    expect(reports.filter((r) => r.kind === 'diagnostic' && r.code === 'refused-url')).toHaveLength(2);
  });

  describe('ChoicePicker binds a list of strings', () => {
    const picker = (extra: Record<string, unknown>) => [
      create(v), data(v, { pick: ['b'] }),
      components(v, [{ id: 'root', component: 'ChoicePicker', label: 'Size', options: [{ label: 'Small', value: 'a' }, { label: 'Medium', value: 'b' }, { label: 'Large', value: 'c' }], value: path(v, '/pick'), ...extra }]),
    ];
    const pick = (s: () => { dataModel: (v: V) => unknown }) => (s().dataModel(v) as { surfaces: Record<string, { pick: string[] }> }).surfaces.s.pick;
    it('one, as chips: a radio group with one tab stop; arrow keys choose', () => {
      const { feed, session } = mount();
      feed(...picker({ variant: 'mutuallyExclusive', displayStyle: 'chips' }));
      const group = screen.getByRole('radiogroup', { name: 'Size' });
      const radios = screen.getAllByRole('radio');
      expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
      fireEvent.keyDown(group, { key: 'ArrowRight' });
      expect(pick(session)).toEqual(['c']);
    });
    it('many, as a list, filtered: the hidden choice is kept once', () => {
      const { feed, session } = mount();
      feed(...picker({ variant: 'multipleSelection', filterable: true }));
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lar' } });
      fireEvent.click(screen.getByText('Large'));
      expect(pick(session)).toEqual(['b', 'c']);
    });
    it('many, filtered: a hidden choice stays chosen', () => {
      const { feed, session } = mount();
      feed(...picker({ variant: 'multipleSelection', displayStyle: 'chips', filterable: true }));
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'LAR' } });
      expect(screen.getAllByRole('button').map((b) => b.textContent)).toContain('Large');
      expect(screen.queryByText('Medium')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Large' }));
      expect(pick(session)).toEqual(['b', 'c']);
    });
  });

  describe('DateTimeInput', () => {
    it('is date-only when neither flag is set', () => {
      const { feed, container } = mount();
      feed(create(v), data(v, { when: '2026-11-25' }), components(v, [{ id: 'root', component: 'DateTimeInput', label: 'Day', value: path(v, '/when') }]));
      expect(screen.getAllByText('Day').length).toBeGreaterThan(0);
      expect(container.textContent).not.toMatch(/Time/);
    });
    it('formats the pickers in the session language, not the page\'s', () => {
      const { feed, container } = mount({ locale: 'en' }, 'ko');
      feed(create(v), data(v, { when: '2025-07-15T19:00:00' }), components(v, [{ id: 'root', component: 'DateTimeInput', label: 'When', enableDate: true, enableTime: true, value: path(v, '/when') }]));
      const fields = [...container.querySelectorAll('.sg-select__value')].map((e) => e.textContent ?? '');
      expect(fields.length).toBe(2);
      expect(fields.join(' ')).not.toMatch(/[가-힣]/);
      expect(fields[1]).toMatch(/PM/);
    });
  });

  it('gives the focus to the surfaces\' region when the agent deletes the surface that held it', async () => {
    const { feed } = mount();
    feed(...form(v));
    const field = screen.getByRole('textbox', { name: 'Name' });
    act(() => field.focus());
    feed(remove(v));
    await frame();
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Agent content' }));
  });

  it('leaves the focus alone when a surface that did not hold it is deleted', async () => {
    const { feed } = mount();
    feed(...form(v), create(v, 'other'), components(v, [{ id: 'root', component: 'Text', text: 'Other' }], 'other'));
    const field = screen.getByRole('textbox', { name: 'Name' });
    act(() => field.focus());
    feed(remove(v, 'other'));
    await frame();
    expect(document.activeElement).toBe(field);
  });
});

it('takes JSONL, reports a line that does not parse and goes on', () => {
  const reports: A2uiReport[] = [];
  const { session } = mount({ onReport: (r) => reports.push(r) });
  act(() => session().process([JSON.stringify(create('1.0')), '{oops', JSON.stringify(components('1.0', [{ id: 'root', component: 'Text', text: 'From JSONL' }]))].join('\n')));
  expect(screen.getByText('From JSONL')).toBeTruthy();
  expect(reports.filter((r) => r.kind === 'input')).toHaveLength(1);
});

it('names the region and the built-in words in the nearest ThemeProvider\'s language', () => {
  const { feed } = mount({}, 'ko');
  feed(create('1.0'));
  expect(screen.getByRole('region', { name: '에이전트 콘텐츠' })).toBeTruthy();
});

describe.each<V>(['1.0', '0.9'])('formatDate in v%s', (v) => {
  it('keeps quoted text in the pattern', () => {
    const { feed } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'Text', text: call(v, 'formatDate', { value: '2025-07-15T19:00:00Z', format: "EEEE, MMMM d, yyyy 'at' h:mm a" }) }]));
    expect(screen.getByText('Tuesday, July 15, 2025 at 7:00 PM')).toBeTruthy();
  });
  it('writes nothing, not the quoted text alone, while there is no date', () => {
    for (const value of [path(v, '/when'), '', 'soon']) {
      const { feed, container, unmount } = mount();
      feed(create(v), components(v, [{ id: 'root', component: 'Text', text: call(v, 'formatDate', { value, format: "EEEE, MMMM d, yyyy 'at' h:mm a" }) }]));
      expect(`${JSON.stringify(value)} → ${container.textContent}`).not.toMatch(/→ .*\bat\b/);
      unmount();
    }
  });
  /* web_core writes a whole ISO timestamp only for the pattern "ISO" itself: a run between quotes that reads "ISO" is
     letters of a longer pattern, as it would be without the quotes (#97 review) */
  it('does not turn a run that reads ISO into the ISO timestamp', () => {
    const { feed, container } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'Text', text: call(v, 'formatDate', { value: '2025-07-15T19:00:00Z', format: "ISO''" }) }]));
    expect(container.textContent).not.toContain('2025-07-15T19:00:00');
    expect(container.textContent?.endsWith("'")).toBe(true);
  });
});

describe('keepQuoted', () => {
  it('leaves quoted runs as they are, writes \'\' as one quote, and formats the rest', async () => {
    const { keepQuoted } = await import('../src/functions');
    expect(keepQuoted("h 'o''clock' a", (p) => p.toUpperCase())).toBe("H o'clock A");
    expect(keepQuoted("'at'", (p) => p.toUpperCase())).toBe('at');
    expect(keepQuoted("d '' M", (p) => p.toUpperCase())).toBe("D ' M");
  });
});

describe.each<V>(['1.0', '0.9'])('cards in v%s', (v) => {
  const nested = [
    { id: 'root', component: 'Card', child: 'col' },
    { id: 'col', component: 'Column', children: ['title', 'inner'] },
    { id: 'title', component: 'Text', text: 'Outer' },
    { id: 'inner', component: 'Card', child: 'innerText' },
    { id: 'innerText', component: 'Text', text: 'Inner' },
  ];
  const cardOf = (text: string) => screen.getByText(text).closest('.sg-card')!;
  it('draws the outermost card as a surface and a card inside it with a hairline', () => {
    const { feed } = mount();
    feed(create(v), components(v, nested));
    expect(cardOf('Outer').classList.contains('sg-card--outlined')).toBe(false);
    expect(cardOf('Inner').classList.contains('sg-card--outlined')).toBe(true);
  });
  it('starts again inside a modal\'s dialog', async () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Card', child: 'm' },
      { id: 'm', component: 'Modal', trigger: 'open', content: 'dc', ...a11y(v, 'More') },
      { id: 'open', component: 'Button', child: 'ot', action: { event: { name: 'opened' } } }, { id: 'ot', component: 'Text', text: 'Open' },
      { id: 'dc', component: 'Card', child: 'dt' }, { id: 'dt', component: 'Text', text: 'In the dialog' },
    ]));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('dialog', { name: 'More' });
    expect(cardOf('In the dialog').classList.contains('sg-card--outlined')).toBe(false);
  });
});

describe('where the surfaces sit (ground)', () => {
  const msgs = [create('1.0'), components('1.0', [{ id: 'root', component: 'Card', child: 't' }, { id: 't', component: 'Text', text: 'Agent card' }])];
  function Draw({ ground, provider }: { ground?: 'page' | 'surface'; provider?: 'page' | 'surface' }) {
    const a2ui = useA2ui();
    useEffect(() => { a2ui.process(msgs); }, [a2ui]);
    const s = <A2uiSurfaces a2ui={a2ui} ground={ground} />;
    return provider ? <A2uiProvider ground={provider}>{s}</A2uiProvider> : s;
  }
  const outlined = () => screen.getByText('Agent card').closest('.sg-card')!.classList.contains('sg-card--outlined');
  it('draws the outermost card as a surface by default (on the page)', () => {
    render(<ThemeProvider><Draw /></ThemeProvider>);
    expect(outlined()).toBe(false);
  });
  it('draws every card with a hairline when the surfaces already sit on a surface', () => {
    render(<ThemeProvider><Draw ground="surface" /></ThemeProvider>);
    expect(outlined()).toBe(true);
  });
  it('takes the nearest A2uiProvider\'s ground, and its own option first', () => {
    const { unmount } = render(<ThemeProvider><Draw provider="surface" /></ThemeProvider>);
    expect(outlined()).toBe(true);
    unmount();
    render(<ThemeProvider><Draw provider="surface" ground="page" /></ThemeProvider>);
    expect(outlined()).toBe(false);
  });
});

describe.each<V>(['1.0', '0.9'])('button labels in v%s', (v) => {
  const button = (child: Record<string, unknown>[], childId = 'l') => [create(v), components(v, [
    { id: 'root', component: 'Button', child: childId, action: { event: { name: 'go' } } }, ...child,
  ])];
  it('writes a plain label in the button\'s own type', () => {
    const { feed } = mount();
    feed(...button([{ id: 'l', component: 'Text', text: 'Purchase' }]));
    const b = screen.getByRole('button', { name: 'Purchase' });
    expect(b.querySelector('.sg-text')).toBeNull();
    expect(b.querySelector('p')).toBeNull();
  });
  /* as the paragraph it replaced: a newline in the label breaks the line, and a long label wraps in a narrow button
     (Satin's button keeps its own label on one line) */
  it('keeps the label\'s line breaks and wrapping', () => {
    const { feed } = mount();
    feed(...button([{ id: 'l', component: 'Text', text: 'Pay now\nor later' }]));
    const label = screen.getByRole('button', { name: /Pay now/ }).querySelector('span[style]') as HTMLElement;
    expect(label.textContent).toBe('Pay now\nor later');
    expect(label.style.whiteSpace).toBe('pre-line');
  });
  it('keeps inline emphasis in a label', () => {
    const { feed } = mount();
    feed(...button([{ id: 'l', component: 'Text', text: '**Buy** now' }]));
    expect(screen.getByRole('button', { name: 'Buy now' }).querySelector('strong')?.textContent).toBe('Buy');
  });
  it('leaves a heading in a button as it is', () => {
    const { feed } = mount();
    feed(...button([v === '1.0' ? { id: 'l', component: 'Text', text: '### Title' } : { id: 'l', component: 'Text', text: 'Title', variant: 'h3' }]));
    expect(screen.getByRole('button', { name: 'Title' }).querySelector('.sg-text')).not.toBeNull();
  });
  it('writes a label beside an icon in the button\'s type too', () => {
    const { feed } = mount();
    feed(...button([
      { id: 'r', component: 'Row', children: ['i', 'l'] },
      { id: 'i', component: 'Icon', name: 'send' }, { id: 'l', component: 'Text', text: 'Send' },
    ], 'r'));
    expect(screen.getByRole('button', { name: 'Send' }).querySelector('.sg-text')).toBeNull();
  });
});

describe.each<V>(['1.0', '0.9'])('edge images in v%s', (v) => {
  const img = (id: string, extra: Record<string, unknown> = {}) => ({ id, component: 'Image', url: 'https://example.com/a.jpg', description: 'Poster', ...extra });
  const edgeOf = (alt = 'Poster') => screen.getByAltText(alt).parentElement?.getAttribute('data-a2ui-edge') ?? null;
  const allow = { allowUrl: () => true };
  it('draws a feature image at the top of a card\'s column edge to edge', () => {
    const { feed } = mount(allow);
    feed(create(v), components(v, [
      { id: 'root', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: ['pic', 'txt'] },
      img('pic'), { id: 'txt', component: 'Text', text: 'Title' },
    ]));
    expect(edgeOf()).toBe('top');
    expect((screen.getByAltText('Poster') as HTMLImageElement).style.borderRadius).toMatch(/^0/);
  });
  it('draws it at the bottom when it is the last, and all round when it is the card\'s only child', () => {
    const { feed } = mount(allow);
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['c1', 'c2'] },
      { id: 'c1', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: ['txt', 'pic'] },
      { id: 'txt', component: 'Text', text: 'Title' }, img('pic'),
      { id: 'c2', component: 'Card', child: 'solo' }, img('solo', { description: 'Solo' }),
    ]));
    expect(edgeOf()).toBe('bottom');
    expect(edgeOf('Solo')).toBe('all');
  });
  it('keeps inset an image in a centred column, in a row, as an avatar, or deeper inside', () => {
    const { feed } = mount(allow);
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['a', 'b', 'c', 'd'] },
      { id: 'a', component: 'Card', child: 'ac' }, { id: 'ac', component: 'Column', align: 'center', children: ['ai'] }, img('ai', { description: 'Centred' }),
      { id: 'b', component: 'Card', child: 'br' }, { id: 'br', component: 'Row', children: ['bi'] }, img('bi', { description: 'In a row' }),
      { id: 'c', component: 'Card', child: 'cc' }, { id: 'cc', component: 'Column', children: ['ci'] }, img('ci', { description: 'Avatar', variant: 'avatar' }),
      { id: 'd', component: 'Card', child: 'dc' }, { id: 'dc', component: 'Column', children: ['dr'] }, { id: 'dr', component: 'Row', children: ['di'] }, img('di', { description: 'Deeper' }),
    ]));
    for (const alt of ['Centred', 'In a row', 'Avatar', 'Deeper']) expect(edgeOf(alt)).toBeNull();
  });
  it('decides again when the first child arrives late', () => {
    const { feed } = mount(allow);
    feed(create(v), components(v, [
      { id: 'root', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: ['pic', 'txt'] }, { id: 'txt', component: 'Text', text: 'Title' },
    ]));
    feed(components(v, [img('pic')]));
    expect(edgeOf()).toBe('top');
  });
  it('leaves no band for a refused image or one that fails to load', () => {
    const { feed } = mount(allow);
    feed(create(v), components(v, [
      { id: 'root', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: ['pic', 'txt'] },
      img('pic'), { id: 'txt', component: 'Text', text: 'Title' },
    ]));
    fireEvent.error(screen.getByAltText('Poster'));
    expect(screen.queryByAltText('Poster')).toBeNull();
    expect(document.querySelector('[data-a2ui-edge]')).toBeNull();
    /* what a broken image would still have said, a screen reader still hears (#97 review) */
    expect(screen.getByRole('img', { name: 'Poster' }).tagName).toBe('SPAN');
  });
  /* the edge is decided again when the Column's align changes, but its children stay mounted: a remount would drop
     their focus and their own state, such as a chosen tab (#97 review) */
  it('keeps a Column\'s children mounted when its align changes', () => {
    const { feed } = mount(allow);
    const col = (align?: string) => components(v, [
      { id: 'root', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: ['pic', 'txt'], ...(align ? { align } : {}) },
      img('pic'), { id: 'txt', component: 'Text', text: 'Title' },
    ]);
    feed(create(v), col());
    const before = screen.getByText('Title');
    expect(edgeOf()).toBe('top');
    feed(col('center'));
    expect(edgeOf()).toBeNull();
    expect(screen.getByText('Title')).toBe(before);
    feed(col());
    expect(screen.getByText('Title')).toBe(before);
  });
  /* the same node shown another URL and then the failed one again tries it again (#97 review) */
  it('tries a failed URL again when it comes back', () => {
    const { feed } = mount(allow);
    const at = (url: string) => components(v, [
      { id: 'root', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: ['pic', 'txt'] },
      img('pic', { url }), { id: 'txt', component: 'Text', text: 'Title' },
    ]);
    feed(create(v), at('https://example.com/a.jpg'));
    fireEvent.error(screen.getByAltText('Poster'));
    feed(at('https://example.com/b.jpg'));
    expect(screen.getByAltText('Poster').getAttribute('src')).toBe('https://example.com/b.jpg');
    feed(at('https://example.com/a.jpg'));
    expect(screen.getByAltText('Poster').getAttribute('src')).toBe('https://example.com/a.jpg');
  });
  it('keeps the agent\'s fit, and covers when it gave none', () => {
    const { feed } = mount(allow);
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['c1', 'c2'] },
      { id: 'c1', component: 'Card', child: 'p1' }, img('p1', { description: 'No fit' }),
      { id: 'c2', component: 'Card', child: 'p2' }, img('p2', { description: 'Contain', fit: 'contain' }),
    ]));
    expect((screen.getByAltText('No fit') as HTMLImageElement).style.objectFit).toBe('cover');
    expect((screen.getByAltText('Contain') as HTMLImageElement).style.objectFit).toBe('contain');
  });
});
