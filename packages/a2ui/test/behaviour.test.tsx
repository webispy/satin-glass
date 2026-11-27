import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    /* blocked by its checks: unavailable (aria-disabled, still focusable), and why is its description, not yet shown */
    const blocked = () => save.getAttribute('aria-disabled') === 'true';
    expect(save.disabled).toBe(false);
    expect(blocked()).toBe(true);
    const why = document.getElementById(save.getAttribute('aria-describedby')!);
    expect(why?.textContent).toBe('Fix the name first.');
    expect(why?.closest('.sg-visually-hidden')).not.toBeNull();
    const field = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'ab' } });
    expect(blocked()).toBe(true);
    /* the field's own message shows only once the field has been left */
    expect(screen.queryByText('Use at least 3 characters.')).toBeNull();
    fireEvent.blur(field);
    await tick();
    expect(screen.getByText('Use at least 3 characters.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(field, { target: { value: 'abc' } });
    expect(blocked()).toBe(false);
    expect(save.getAttribute('aria-describedby')).toBeNull();
    expect(field.getAttribute('aria-invalid')).not.toBe('true');
    await act(async () => { fireEvent.click(save); await Promise.resolve(); });
    const actions = sent.filter((m) => (m as { action?: unknown }).action) as { version: string; action: { name: string; surfaceId: string; sourceComponentId: string; context: Record<string, unknown> } }[];
    expect(actions).toHaveLength(1);
    expect(actions[0].version).toBe(wire(v));
    expect(actions[0].action).toMatchObject({ name: 'save', surfaceId: 's', sourceComponentId: 'save', context: { name: 'abc', email: true } });
  });

  it('a press on a blocked button sends nothing, shows why, shows the errors of the fields its checks read and focuses the first', async () => {
    const sent: unknown[] = [];
    const { feed } = mount({ onOutbound: (m) => { sent.push(m); } });
    feed(...form(v));
    const save = screen.getByRole('button', { name: 'Save' });
    const field = screen.getByRole('textbox', { name: 'Name' });
    expect(screen.queryByText('Use at least 3 characters.')).toBeNull();
    await act(async () => { fireEvent.click(save); await Promise.resolve(); });
    await tick();
    expect(sent.filter((m) => (m as { action?: unknown }).action)).toHaveLength(0);
    const why = screen.getByText('Fix the name first.');
    expect(why.closest('.sg-visually-hidden')).toBeNull();
    expect(save.getAttribute('aria-describedby')).toBe(why.id);
    expect(screen.getByText('Use at least 3 characters.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
    /* fields the checks do not read keep their own state: the checkbox shows nothing */
    expect(screen.getByRole('checkbox', { name: 'Email me' }).getAttribute('aria-invalid')).not.toBe('true');
    /* once the checks pass, the reason goes; failing again, it starts hidden */
    fireEvent.change(field, { target: { value: 'abcd' } });
    expect(screen.queryByText('Fix the name first.')).toBeNull();
    fireEvent.change(field, { target: { value: 'a' } });
    expect(screen.getByText('Fix the name first.').closest('.sg-visually-hidden')).not.toBeNull();
  });

  /* each refused press is said: the reason was already the button's description, and the focus may not move, so a
     live region says it again with how many fields need attention, as a new node each time (#98 review) */
  it('says each refused press in a live region, with the number of fields to fix', async () => {
    const { feed } = mount();
    feed(...form(v));
    const save = screen.getByRole('button', { name: 'Save' });
    const live = () => save.parentElement!.querySelector<HTMLElement>('[aria-live="polite"]');
    expect(live()?.textContent).toBe('');
    await act(async () => { fireEvent.click(save); await Promise.resolve(); });
    await tick();
    expect(live()?.textContent).toBe('Fix the name first. 1 field needs attention.');
    const first = live()!.firstElementChild;
    await act(async () => { fireEvent.click(save); await Promise.resolve(); });
    await tick();
    expect(live()!.firstElementChild).not.toBe(first);
  });
  /* the focus goes to the first invalid field that takes it: a disabled one is passed
     over for the next (#98 review); a Slider whose range has no width is disabled */
  it('focuses the first invalid field that can take the focus', async () => {
    const { feed } = mount();
    feed(create(v), data(v, { volume: 10, name: '' }), components(v, [
      { id: 'root', component: 'Column', children: ['volume', 'name', 'go'] },
      { id: 'volume', component: 'Slider', label: 'Volume', min: 50, max: 50, value: path(v, '/volume'),
        ...checks(v, [{ condition: call(v, 'numeric', { value: path(v, '/volume'), min: 50 }), message: 'Turn it up.' }]) },
      { id: 'name', component: 'TextField', label: 'Name', value: path(v, '/name'),
        ...checks(v, [{ condition: call(v, 'length', { value: path(v, '/name'), min: 3 }), message: 'Use at least 3 characters.' }]) },
      { id: 'go', component: 'Button', child: 'gt', action: { event: { name: 'go' } },
        ...checks(v, [{ condition: call(v, 'and', { values: [call(v, 'numeric', { value: path(v, '/volume'), min: 50 }), call(v, 'length', { value: path(v, '/name'), min: 3 })] }), message: 'Not yet.' }]) },
      { id: 'gt', component: 'Text', text: 'Go' },
    ]));
    expect(screen.getByRole('slider', { name: 'Volume' }).getAttribute('aria-disabled')).toBe('true');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Go' })); await Promise.resolve(); });
    await tick();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' }));
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

describe('dateValue', () => {
  it('gives a date-only value a midnight time, so every engine reads it (WebKit refuses "2025-12-28Z")', async () => {
    const { dateValue } = await import('../src/functions');
    expect(dateValue('2025-12-28')).toBe('2025-12-28T00:00:00');
    for (const v of ['2025-12-28T19:00:00Z', '2025-12-28T19:00:00+09:00', '', 'soon', 42, null]) expect(dateValue(v)).toBe(v);
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

describe('isCropped', () => {
  it('is true only when a covered box differs from the photo by more than 3 %', async () => {
    const { isCropped } = await import('../src/components/media');
    expect(isCropped({ w: 300, h: 300 }, { w: 300, h: 309 }, 'cover')).toBe(false);
    expect(isCropped({ w: 300, h: 300 }, { w: 300, h: 310 }, 'cover')).toBe(true);
    expect(isCropped({ w: 300, h: 300 }, { w: 300, h: 600 }, 'contain')).toBe(false);
    expect(isCropped({ w: 0, h: 300 }, { w: 300, h: 600 }, 'cover')).toBe(false);
    expect(isCropped({ w: 300, h: 300 }, { w: 0, h: 0 }, 'cover')).toBe(false);
  });
});

describe.each<V>(['1.0', '0.9'])('the whole image in v%s', (v) => {
  const poster = { id: 'pic', component: 'Image', url: 'https://example.com/p.jpg', description: 'Poster' };
  const inCard = (first: Record<string, unknown>, ...more: Record<string, unknown>[]) => components(v, [
    { id: 'root', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: [first.id as string, 'txt'] },
    first, { id: 'txt', component: 'Text', text: 'Title' }, ...more,
  ]);
  /* a 2:3 photo in a 4:5 box: jsdom has no layout, so the sizes are given */
  const crop = (img: HTMLImageElement, natural = { w: 200, h: 300 }, box = { w: 320, h: 400 }) => {
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: natural.w });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: natural.h });
    Object.defineProperty(img, 'clientWidth', { configurable: true, value: box.w });
    Object.defineProperty(img, 'clientHeight', { configurable: true, value: box.h });
    fireEvent.load(img);
  };
  it('turns a cropped edge image into a button that opens the viewer', async () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), inCard(poster));
    crop(screen.getByAltText('Poster') as HTMLImageElement);
    const open = screen.getByRole('button', { name: 'View the whole image: Poster' });
    expect(open.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(open);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
  it('leaves an image that is not cropped as an image', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), inCard(poster));
    crop(screen.getByAltText('Poster') as HTMLImageElement, { w: 320, h: 400 });
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('does not take the focus when an image becomes a button', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), inCard(poster));
    const before = document.activeElement;
    crop(screen.getByAltText('Poster') as HTMLImageElement);
    expect(document.activeElement).toBe(before);
  });
  it('leaves alone an image in a button', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), components(v, [
      { id: 'root', component: 'Card', child: 'b' }, { id: 'b', component: 'Button', child: 'col', action: { event: { name: 'go' } } },
      { id: 'col', component: 'Column', children: ['pic', 'txt'] }, poster, { id: 'txt', component: 'Text', text: 'Title' },
    ]));
    const img = screen.queryByAltText('Poster') as HTMLImageElement | null;
    if (img) crop(img);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
  it('names the button in the session\'s language', () => {
    const { feed } = mount({ allowUrl: () => true, locale: 'ko' });
    feed(create(v), inCard(poster));
    crop(screen.getByAltText('Poster') as HTMLImageElement);
    expect(screen.getByRole('button', { name: '사진 전체 보기: Poster' })).toBeTruthy();
  });
  it('shows the library\'s focus ring: no inline reset, the focusable class', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), inCard(poster));
    crop(screen.getByAltText('Poster') as HTMLImageElement);
    const open = screen.getByRole('button', { name: 'View the whole image: Poster' });
    expect(open.classList.contains('sg-focusable')).toBe(true);
    expect(open.getAttribute('style') ?? '').not.toMatch(/(^|;)\s*all\s*:/);
  });
  it('keeps the same picture when it becomes a button, so its size is still followed', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), inCard(poster));
    const before = screen.getByAltText('Poster');
    crop(before as HTMLImageElement);
    expect(screen.getByRole('button', { name: 'View the whole image: Poster' })).toBeTruthy();
    expect(screen.getByAltText('Poster')).toBe(before);
  });
  it('caps the height from the measured width, without size containment', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), inCard(poster));
    const img = screen.getByAltText('Poster') as HTMLImageElement;
    expect(img.style.maxHeight).toBe('400px');
    crop(img, { w: 200, h: 300 }, { w: 200, h: 250 });
    expect(img.style.maxHeight).toBe('250px');
    crop(img, { w: 200, h: 300 }, { w: 360, h: 400 });
    expect(img.style.maxHeight).toBe('400px');
    expect((img.closest('[data-a2ui-edge]') as HTMLElement).style.containerType).toBe('');
  });
  it('is not a button inside the agent\'s button, even through a card', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), components(v, [
      { id: 'root', component: 'Button', child: 'card', action: { event: { name: 'go' } } },
      { id: 'card', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: ['pic', 'txt'] },
      poster, { id: 'txt', component: 'Text', text: 'Title' },
    ]));
    crop(screen.getByAltText('Poster') as HTMLImageElement);
    expect(screen.queryByRole('button', { name: /View the whole image/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
  it('is not a button inside a dialog\'s trigger, which stays the press target', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), components(v, [
      { id: 'root', component: 'Modal', trigger: 'card', content: 'more' },
      { id: 'card', component: 'Card', child: 'col' }, { id: 'col', component: 'Column', children: ['pic', 'txt'] },
      poster, { id: 'txt', component: 'Text', text: 'Title' }, { id: 'more', component: 'Text', text: 'More' },
    ]));
    crop(screen.getByAltText('Poster') as HTMLImageElement);
    expect(screen.queryByRole('button', { name: /View the whole image/ })).toBeNull();
  });
  it('names the viewer by the picture and its close button in the session\'s language', async () => {
    const { feed } = mount({ allowUrl: () => true, locale: 'ko' });
    feed(create(v), inCard(poster));
    crop(screen.getByAltText('Poster') as HTMLImageElement);
    fireEvent.click(screen.getByRole('button', { name: '사진 전체 보기: Poster' }));
    const viewer = await screen.findByRole('dialog', { name: 'Poster' });
    expect(within(viewer).getByRole('button', { name: '닫기' })).toBeTruthy();
  });
  /* the window widened while the viewer was open, so the photo is no longer cropped: closing it still gives the focus
     back to the button that opened it (the viewer returns it as it closes), which stays while it has the focus */
  it('gives the focus back to its button when the photo stopped being cropped while the viewer was open', async () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), inCard(poster));
    const img = screen.getByAltText('Poster') as HTMLImageElement;
    crop(img);
    const open = screen.getByRole('button', { name: 'View the whole image: Poster' });
    open.focus();
    fireEvent.click(open);
    await screen.findByRole('dialog');
    crop(img, { w: 320, h: 400 });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'View the whole image: Poster' }));
    fireEvent.blur(document.activeElement!);
    expect(screen.queryByRole('button', { name: /View the whole image/ })).toBeNull();
  });
  /* the agent changes only the fit: cover crops, contain does not; the box keeps its size, so it is measured again */
  it('measures again when the agent changes the fit', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), inCard(poster));
    const img = screen.getByAltText('Poster') as HTMLImageElement;
    crop(img);
    expect(screen.queryByRole('button', { name: /View the whole image/ })).not.toBeNull();
    feed(inCard({ ...poster, fit: 'contain' }));
    expect(screen.queryByRole('button', { name: /View the whole image/ })).toBeNull();
    expect(img.getAttribute('aria-hidden')).toBeNull();
    feed(inCard({ ...poster, fit: 'cover' }));
    expect(screen.queryByRole('button', { name: /View the whole image/ })).not.toBeNull();
  });
});

describe('fitsRail', () => {
  it('fits when the rail is measured, no wider than the room, and no name is cut', async () => {
    const { fitsRail } = await import('../src/components/inputs');
    expect(fitsRail({ rail: 180, available: 300, cut: false })).toBe(true);
    expect(fitsRail({ rail: 320, available: 300, cut: false })).toBe(false);
    expect(fitsRail({ rail: 180, available: 300, cut: true })).toBe(false);
    expect(fitsRail({ rail: 0, available: 0, cut: false })).toBe(false);   /* not measured (no layout): chips */
  });
});

describe.each<V>(['1.0', '0.9'])('a short exclusive choice in v%s', (v) => {
  /* jsdom has no layout: the hidden rail measures `rail` px, every other box `room` px */
  const layout = (rail: number, room: number) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented') ? rail : room; });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented__item') ? 50 : room; });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented__item') ? 50 : room; });
  };
  afterEach(() => vi.restoreAllMocks());
  const picker = (value: string[], extra: Record<string, unknown> = {}, options = [{ label: 'Annual', value: 'annual' }, { label: 'Monthly', value: 'monthly' }]) => [
    create(v), data(v, { billing: value }),
    components(v, [{ id: 'root', component: 'ChoicePicker', label: 'Billing', variant: 'mutuallyExclusive', displayStyle: 'chips', options, value: path(v, '/billing'), ...extra }]),
  ];
  const billing = (s: () => { dataModel: (v: V) => unknown }) => (s().dataModel(v) as { surfaces: Record<string, { billing: string[] }> }).surfaces.s.billing;
  it('draws it as a segmented control, and a press writes [value]', () => {
    layout(160, 400);
    const { feed, session, container } = mount();
    feed(...picker(['annual']));
    expect(container.querySelector('[role="radiogroup"].sg-segmented')).not.toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Monthly' }));
    expect(billing(session)).toEqual(['monthly']);
  });
  it('keeps chips when the rail does not fit, a name is cut, or it is filterable, has five options or no matching value', () => {
    const cases: [number, number, unknown[]][] = [
      [500, 400, picker(['annual'])],
      [160, 400, picker(['annual'], { filterable: true })],
      [160, 400, picker(['a'], {}, ['a', 'b', 'c', 'd', 'e'].map((x) => ({ label: x, value: x })))],
      [160, 400, picker([])],
    ];
    for (const [rail, room, msgs] of cases) {
      layout(rail, room);
      const { feed, container, unmount } = mount();
      feed(...msgs);
      expect(container.querySelector('.sg-segmented[role="radiogroup"]')).toBeNull();
      unmount(); vi.restoreAllMocks();
    }
    /* a name cut by the label's 12em cap (the real control's markup) */
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented__label') ? 90 : 400; });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented__label') ? 50 : 400; });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented') ? 160 : 400; });
    const { feed, container } = mount();
    feed(...picker(['annual']));
    expect(container.querySelector('.sg-segmented[role="radiogroup"]')).toBeNull();
  });
  it('does not turn chips into segments when the user picks', () => {
    layout(160, 400);
    const { feed, container } = mount();
    feed(...picker([]));
    fireEvent.click(screen.getByRole('radio', { name: 'Annual' }));
    expect(container.querySelector('.sg-segmented[role="radiogroup"]')).toBeNull();
  });
  it('measures a rail drawn like the real one: each label in its capped span', () => {
    layout(160, 400);
    const { feed, container } = mount();
    feed(...picker(['annual']));
    const probe = container.querySelector('[data-a2ui-probe] .sg-segmented');
    expect([...(probe?.querySelectorAll('.sg-segmented__item > .sg-segmented__label[data-label]') ?? [])].map((e) => e.getAttribute('data-label'))).toEqual(['Annual', 'Monthly']);
  });
  it('moves the focus to the chosen option when it switches while focused', () => {
    layout(500, 400);
    const { feed, container } = mount();
    feed(...picker(['annual']));
    expect(container.querySelector('.sg-segmented[role="radiogroup"]')).toBeNull();
    screen.getByRole('radio', { name: 'Annual' }).focus();
    vi.restoreAllMocks(); layout(160, 400);
    feed(data(v, { billing: ['monthly'] }));
    expect(container.querySelector('.sg-segmented[role="radiogroup"]')).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Monthly' }));
  });
  /* a press on the chosen segment writes the same value, so the binder hands nothing back; the agent then replaces
     the options and keeps the value: the value is no longer an option, so the rail (which always shows one chosen)
     goes back to chips (#97 review) */
  it('goes back to chips when the agent replaces the options after a press on the chosen one', () => {
    layout(160, 400);
    const { feed, container } = mount();
    feed(...picker(['annual']));
    fireEvent.click(screen.getByRole('radio', { name: 'Annual' }));
    feed(components(v, [{ id: 'root', component: 'ChoicePicker', label: 'Billing', variant: 'mutuallyExclusive', displayStyle: 'chips',
      options: [{ label: 'Monthly', value: 'monthly' }, { label: 'Weekly', value: 'weekly' }], value: path(v, '/billing') }]));
    expect(container.querySelector('.sg-segmented[role="radiogroup"]')).toBeNull();
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
  });
  /* weighted in a Row, the picker has its share, not the Row: a 250 px rail does not fit a 150 px share of 400 px */
  it('measures a weighted picker\'s own share of its Row', () => {
    const own = (e: HTMLElement) => !!e.querySelector(':scope > [data-a2ui-probe]');
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented') ? 250 : 400; });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented__item') ? 50 : own(this) ? 150 : 400; });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('sg-segmented__item') ? 50 : 400; });
    const { feed, container } = mount();
    feed(create(v), data(v, { billing: ['annual'] }), components(v, [
      { id: 'root', component: 'Row', children: ['p', 't'] },
      { id: 'p', component: 'ChoicePicker', label: 'Billing', variant: 'mutuallyExclusive', displayStyle: 'chips', weight: 1,
        options: [{ label: 'Annual', value: 'annual' }, { label: 'Monthly', value: 'monthly' }], value: path(v, '/billing') },
      { id: 't', component: 'Text', text: 'Total', weight: 1 },
    ]));
    expect(container.querySelector('.sg-segmented[role="radiogroup"]')).toBeNull();
  });
  it('goes back to chips when the agent clears the value', () => {
    layout(160, 400);
    const { feed, container } = mount();
    feed(...picker(['annual']));
    expect(container.querySelector('.sg-segmented[role="radiogroup"]')).not.toBeNull();
    feed(data(v, { billing: [] }));
    expect(container.querySelector('.sg-segmented[role="radiogroup"]')).toBeNull();
  });
});

describe.each<V>(['1.0', '0.9'])('a blocked button in a surface drawn twice, in v%s', (v) => {
  it('focuses the field of the drawing it was pressed in', async () => {
    let session: ReturnType<typeof useA2ui> | undefined;
    function App() {
      const a2ui = useA2ui({});
      session = a2ui;
      return <ThemeProvider><div data-testid="one"><A2uiSurfaces a2ui={a2ui} /></div><div data-testid="two"><A2uiSurfaces a2ui={a2ui} /></div></ThemeProvider>;
    }
    render(<App />);
    act(() => { for (const m of form(v)) session!.process(m); });
    const two = screen.getByTestId('two');
    await act(async () => { fireEvent.click(within(two).getByRole('button', { name: 'Save' })); await Promise.resolve(); });
    await tick();
    expect(document.activeElement).toBe(within(two).getByRole('textbox', { name: 'Name' }));
    /* the other drawing shows nothing of it */
    expect(within(screen.getByTestId('one')).queryByText('Use at least 3 characters.')).toBeNull();
  });
});

describe.each<V>(['1.0', '0.9'])('layout as the catalog means it, in v%s', (v) => {
  const t = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ id, component: 'Text', text, ...extra });
  const stackOf = (text: string) => screen.getByText(text).closest('.sg-stack') as HTMLElement;
  const flowOf = (text: string) => (screen.getByText(text).closest('.sg-stack')!.parentElement!.closest('.sg-stack') ?? stackOf(text)) as HTMLElement;
  it('aligns by the catalog\'s stretch, and a plain Row with no align by its baselines; an agent\'s align wins', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['plain', 'centred', 'panels'] },
      { id: 'plain', component: 'Row', children: ['a', 'b'] }, t('a', 'Sold by:', { variant: 'caption' }), t('b', 'TechStore'),
      { id: 'centred', component: 'Row', align: 'center', children: ['c', 'd'] }, t('c', 'Left'), t('d', 'Right'),
      { id: 'panels', component: 'Row', children: ['p1', 'e'] }, { id: 'p1', component: 'Column', children: ['f'] }, t('f', 'In a column'), t('e', 'Beside'),
    ]));
    expect(screen.getByText('Sold by:').parentElement!.closest('.sg-stack--row')!.getAttribute('style')).toMatch(/align-items: baseline/);
    expect(screen.getByText('Left').closest('.sg-stack--row')!.getAttribute('style')).toMatch(/align-items: center/);
    expect(screen.getByText('Beside').closest('.sg-stack--row')!.getAttribute('style')).toMatch(/align-items: stretch/);
  });
  it('keeps a Row on one line, wrapping only panels, a Row of Buttons, or the content beside a feature image', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['plain', 'buttons', 'media'] },
      { id: 'plain', component: 'Row', children: ['i', 'x'] }, { id: 'i', component: 'Icon', name: 'send' }, t('x', 'Plain row'),
      { id: 'buttons', component: 'Row', children: ['b1', 'b2'] },
      { id: 'b1', component: 'Button', child: 'b1t', action: { event: { name: 'a' } } }, t('b1t', 'First'),
      { id: 'b2', component: 'Button', child: 'b2t', action: { event: { name: 'b' } } }, t('b2t', 'Second'),
      { id: 'media', component: 'Row', children: ['art', 'about'] }, { id: 'art', component: 'Image', url: 'https://example.com/a.png', description: 'Art' },
      { id: 'about', component: 'Column', children: ['y'] }, t('y', 'About it'),
    ]));
    const wraps = (el: Element | null) => /flex-wrap: wrap/.test(el?.getAttribute('style') ?? '');
    expect(wraps(screen.getByText('Plain row').closest('.sg-stack--row'))).toBe(false);
    expect(wraps(screen.getByRole('button', { name: 'First' }).closest('.sg-stack--row'))).toBe(true);
    expect(wraps(screen.getByAltText('Art').closest('.sg-stack--row'))).toBe(true);
    expect(stackOf('About it').style.flex).toBe('1 1 min(9rem, 100%)');
  });
  it('decides again when a Row\'s children arrive after it', () => {
    const { feed } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'Row', children: ['b1', 'b2'] }]));
    feed(components(v, [
      { id: 'b1', component: 'Button', child: 'b1t', action: { event: { name: 'a' } } }, t('b1t', 'First'),
      { id: 'b2', component: 'Button', child: 'b2t', action: { event: { name: 'b' } } }, t('b2t', 'Second'),
    ]));
    expect(screen.getByRole('button', { name: 'First' }).closest('.sg-stack--row')!.getAttribute('style')).toMatch(/flex-wrap: wrap/);
  });
  /* the wrap beside a feature image is for its text Column: an image beside plain Texts keeps the Row on one line */
  it('wraps beside a feature image only for an unweighted Column of text', () => {
    const { feed } = mount({ allowUrl: () => true });
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['flat'] },
      { id: 'flat', component: 'Row', children: ['art', 'cap'] }, { id: 'art', component: 'Image', url: 'https://example.com/a.png', description: 'Cover' }, t('cap', 'Caption'),
    ]));
    expect(screen.getByAltText('Cover').closest('.sg-stack--row')!.getAttribute('style')).not.toMatch(/flex-wrap: wrap/);
  });
  /* children that arrive after their Row are followed afterwards too: here they gain weights, and the Row becomes a
     table row (#98 review) */
  it('follows the later updates of children that arrived after their Row', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['line'] }, { id: 'line', component: 'Row', children: ['c1', 'c2'] },
    ]));
    feed(components(v, [t('c1', 'Bitcoin'), t('c2', '$43,500.25')]));
    const row = () => screen.getByText('Bitcoin').closest('.sg-stack--row') as HTMLElement;
    expect(row().style.minWidth).not.toBe('var(--a2ui-table-min, 0px)');
    feed(components(v, [t('c1', 'Bitcoin', { weight: 2 }), t('c2', '$43,500.25', { weight: 1 })]));
    expect(row().style.minWidth).toBe('var(--a2ui-table-min, 0px)');
  });
  /* a template's instances count one by one: six Buttons from one template are a Row of Buttons, which wraps
     (#98 review) */
  it('counts each instance of a template among a Row\'s children', () => {
    const { feed } = mount();
    feed(create(v), data(v, { tags: ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => ({ n })) }), components(v, [
      { id: 'root', component: 'Row', children: { path: '/tags', componentId: 'tag' } },
      { id: 'tag', component: 'Button', child: 'tagt', action: { event: { name: 'pick' } } }, t('tagt', path(v, 'n') as unknown as string),
    ]));
    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.getAllByRole('button')[0].closest('.sg-stack--row')!.getAttribute('style')).toMatch(/flex-wrap: wrap/);
  });
  it('sizes spread Rows, fields and buttons in a centred Column, and keeps a Column of texts tight', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', align: 'center', children: ['ends', 'around', 'field', 'go', 'pair'] },
      { id: 'ends', component: 'Row', justify: 'spaceBetween', children: ['e1', 'e2'] }, t('e1', '1:48'), t('e2', '4:22'),
      { id: 'around', component: 'Row', justify: 'spaceAround', children: ['a1', 'a2', 'a3'] }, t('a1', '14'), t('a2', '08'), t('a3', '32'),
      { id: 'field', component: 'TextField', label: 'Name', value: path(v, '/n') },
      { id: 'go', component: 'Button', child: 'gt', action: { event: { name: 'go' } } }, t('gt', 'Go'),
      { id: 'pair', component: 'Column', children: ['n', 's'] }, t('n', 'Bitcoin'), t('s', 'BTC', { variant: 'caption' }),
    ]));
    expect(screen.getByText('1:48').closest('.sg-stack--row')!.getAttribute('style')).toMatch(/align-self: stretch/);
    expect((screen.getByText('14').closest('.sg-stack--row') as HTMLElement).style.width).toBe('min(100%, 18rem)');
    expect((screen.getByRole('textbox', { name: 'Name' }).closest('.sg-field')!.parentElement as HTMLElement).style.alignSelf).toBe('stretch');
    expect((screen.getByRole('button', { name: 'Go' }).parentElement as HTMLElement).style.width).toBe('fit-content');
    expect(stackOf('BTC').getAttribute('style')).toMatch(/gap: var\(--sg-space-1/);
  });
  it('gives a weighted TextField\'s whole field its share of a Row', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Row', children: ['first', 'last'] },
      { id: 'first', component: 'TextField', label: 'First', value: path(v, '/f'), weight: 1 },
      { id: 'last', component: 'TextField', label: 'Last', value: path(v, '/l'), weight: 1 },
    ]));
    const box = (name: string) => screen.getByRole('textbox', { name }).closest('.sg-field')!.parentElement as HTMLElement;
    expect(box('First').style.flex).toBe('1 1 0px');
    expect((screen.getByRole('textbox', { name: 'First' }) as HTMLElement).style.flex).toBe('');
  });
  it('keeps an inset image at its own size, unstretched, and centres an icon (in a button, at the button\'s size)', () => {
    const { feed } = mount({ allowUrl: () => true, icons: { send: <svg data-testid="glyph" /> } });
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['art', 'i', 'b'] },
      { id: 'art', component: 'Image', url: 'https://example.com/a.png', description: 'Thumb' },
      { id: 'i', component: 'Icon', name: 'send' },
      { id: 'b', component: 'Button', child: 'bi', action: { event: { name: 'go' } } }, { id: 'bi', component: 'Icon', name: 'send' },
    ]));
    const img = screen.getByAltText('Thumb') as HTMLImageElement;
    expect([img.style.width, img.style.maxWidth, img.style.alignSelf]).toEqual(['auto', 'min(100%, 300px)', 'flex-start']);
    const [alone, inButton] = screen.getAllByTestId('glyph').map((g) => g.parentElement as HTMLElement);
    expect([alone.style.width, alone.style.alignItems, alone.style.justifyContent]).toEqual(['24px', 'center', 'center']);
    expect(inButton.style.width).toBe('');
  });
  it('writes numbers with group separators as one word, and weighted cells of a Row with tabular figures', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Row', children: ['k', 'val'] }, t('k', 'Market cap', { weight: 1 }), t('val', 'Cap $850,000,000,000.00 today', { weight: 1 }),
    ]));
    expect(screen.getByText('$850,000,000,000.00').style.whiteSpace).toBe('nowrap');
    expect(screen.getByText('Market cap').style.fontVariantNumeric).toBe('tabular-nums');
  });
  /* a token long for a word (a URL, an email, an ID) may break anywhere, as a last resort, so beside an icon or an
     avatar it wraps inside the card instead of running out of it; words of ordinary length, grouped numbers, CJK
     prose, a table's cells and a button's label keep their words whole (#100) */
  it('lets a token long for a word break anywhere, and nothing else', () => {
    const anywhere = () => [...document.querySelectorAll<HTMLElement>('span')].filter((x) => x.style.overflowWrap === 'anywhere').map((x) => x.textContent);
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'tbl', 'btn'] },
      t('a', 'Write to verylongname.surname@example-company.com today'),
      t('b', 'twentycharacterword! stays whole'),                          /* 20: a word */
      t('c', 'Cap $850,000,000,000,000,000.00 today'),                     /* a grouped number of 27: whole */
      t('d', 'これは区切りのない長い日本語の文章でブラウザが文字の間で改行できるもの'),   /* CJK prose: the browser's */
      t('e', '注文番号 ORD-2026-11-27-ABCDEFGHIJKLMNOP を確認'),              /* a long ID in CJK prose */
      t('f', 'See **https://example.com/a/very/long/path/to/a/page** and `0123456789abcdef0123456789`'),
      t('g', '## Heading with averyveryveryverylongtokenhere'),
      t('h', 'Short words only, many of them, in a long sentence that wraps'),
      t('i', 'twentyonecharacterwrd and *anitalictokenthatislongerthantwenty*'),   /* 21: a token */
      t('j', 'amount=$850,000,000,000.00&cur=USD'),                   /* a grouped number inside a token: kept whole, the rest too short */
      t('k', 'Han 𠀀𠀁𠀂𠀃𠀄𠀅𠀆𠀇𠀈𠀉𠀊𠀋𠀌𠀍𠀎𠀏𠀐𠀑𠀒𠀓𠀔𠀕 and ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵ'),    /* Extension B prose; a fullwidth Latin ID */
      t('l', '- first item\n- second item with averyveryveryverylongtokeninalist'),
      /* a table's row (a weighted Column or Card would make it a row of panels instead, which wraps) */
      { id: 'tbl', component: 'Row', children: ['c1', 'c2'] }, t('c1', 'ID', { weight: 1 }), t('c2', 'abcdefghijklmnopqrstuvwxyz0123', { weight: 1 }),
      { id: 'btn', component: 'Button', child: 'bt', action: { event: { name: 'go' } } }, t('bt', 'Open https://example.com/a/long/path'),
    ]));
    expect(anywhere()).toEqual([
      'verylongname.surname@example-company.com',
      'ORD-2026-11-27-ABCDEFGHIJKLMNOP',
      'https://example.com/a/very/long/path/to/a/page',
      '0123456789abcdef0123456789',
      'averyveryveryverylongtokenhere',
      'twentyonecharacterwrd',
      'anitalictokenthatislongerthantwenty',
      'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵ',
      'averyveryveryverylongtokeninalist',
    ]);
    /* a grouped number inside a longer token stays whole */
    expect(screen.getByText('$850,000,000,000.00').style.whiteSpace).toBe('nowrap');
    expect(screen.getByText('$850,000,000,000,000,000.00').style.whiteSpace).toBe('nowrap');
    /* the strong and the code keep their elements, the token inside them */
    expect(screen.getByText('https://example.com/a/very/long/path/to/a/page').parentElement!.tagName).toBe('STRONG');
    expect(screen.getByText('0123456789abcdef0123456789').parentElement!.tagName).toBe('CODE');
  });
  it('keeps a Row\'s children mounted when a second weight makes it a table\'s row', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['r'] },
      { id: 'r', component: 'Row', children: ['x', 'y'] }, t('x', 'Label', { weight: 1 }), t('y', 'Value'),
    ]));
    const before = screen.getByText('Label');
    feed(components(v, [t('y', 'Value', { weight: 1 })]));   /* now two weights: a table's row */
    expect(screen.getByText('Label')).toBe(before);
  });
  it('makes Rows of two or more weighted cells rows of one table in their Column', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['head', 'line'] },
      { id: 'head', component: 'Row', children: ['h1', 'h2'] }, t('h1', 'Asset', { weight: 2 }), t('h2', 'Price', { weight: 1 }),
      { id: 'line', component: 'Row', children: ['c1', 'c2'] }, t('c1', 'Bitcoin', { weight: 2 }), t('c2', '$43,500.25', { weight: 1 }),
    ]));
    for (const text of ['Asset', 'Bitcoin']) expect((screen.getByText(text).closest('.sg-stack--row') as HTMLElement).style.minWidth).toBe('var(--a2ui-table-min, 0px)');
  });
  /* the fonts finishing after a row has left its table do not bring the table back (#98 review) */
  it('does not measure a row again for a table it has left, when the fonts finish later', async () => {
    let ready!: () => void;
    const fonts = { ready: new Promise<void>((r) => { ready = r; }), addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    try {
      const { feed } = mount();
      const rows = (w: number) => components(v, [
        { id: 'root', component: 'Column', children: ['line'] },
        { id: 'line', component: 'Row', children: ['c1', 'c2'] }, t('c1', 'Bitcoin', { weight: w }), t('c2', '$43,500.25', { weight: w }),
      ]);
      feed(create(v), rows(1));
      expect(document.querySelector('[data-a2ui-table]')).not.toBeNull();
      feed(rows(0));
      expect(document.querySelector('[data-a2ui-table]')).toBeNull();
      await act(async () => { ready(); await fonts.ready; });
      expect(document.querySelector('[data-a2ui-table]')).toBeNull();
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });
  /* a table that fits is not a scrolling region: no name, no Tab stop, no keys to take; it becomes one when it is
     narrower than its rows, and stops being one when it fits again (#98 review) */
  it('is a named, focusable scrolling region only while it overflows', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['head', 'line'] },
      { id: 'head', component: 'Row', children: ['h1', 'h2'] }, t('h1', 'Asset', { weight: 2 }), t('h2', 'Price', { weight: 1 }),
      { id: 'line', component: 'Row', children: ['c1', 'c2'] }, t('c1', 'Bitcoin', { weight: 2 }), t('c2', '$43,500.25', { weight: 1 }),
    ]));
    const table = document.querySelector<HTMLElement>('[data-a2ui-table]')!;
    expect(table.style.getPropertyValue('--a2ui-table-min')).not.toBe('');
    expect(table.getAttribute('role')).toBeNull();
    expect(table.getAttribute('tabindex')).toBeNull();
    let over = true;
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) { return this === table && over ? 600 : 0; });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this === table ? 400 : 0; });
    fireEvent.scroll(table);
    expect(table.getAttribute('role')).toBe('region');
    expect(table.tabIndex).toBe(0);
    over = false;
    fireEvent.scroll(table);
    expect(table.getAttribute('role')).toBeNull();
    vi.restoreAllMocks();
  });
});

describe.each<V>(['1.0', '0.9'])('row reflow in v%s', (v) => {
  const panel = (text: string) => screen.getByText(text).closest('[data-a2ui-panel]');
  it('marks weighted columns and cards in a row as panels that stack when the row is narrow', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Row', children: ['a', 'b'] },
      { id: 'a', component: 'Column', weight: 1, children: ['at'] }, { id: 'at', component: 'Text', text: 'Editor' },
      { id: 'b', component: 'Card', weight: 2, child: 'bt' }, { id: 'bt', component: 'Text', text: 'Preview' },
    ]));
    expect(panel('Editor')).not.toBeNull();
    expect(panel('Preview')).not.toBeNull();
  });
  it('leaves compact rows alone: weighted text, an icon and a label, a key and a value, buttons', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Column', children: ['r1', 'r2'] },
      { id: 'r1', component: 'Row', justify: 'spaceBetween', children: ['k', 'val'] },
      { id: 'k', component: 'Text', text: 'Subtotal', weight: 1 }, { id: 'val', component: 'Text', text: '$10.70' },
      { id: 'r2', component: 'Row', children: ['i', 'l'] }, { id: 'i', component: 'Icon', name: 'send' }, { id: 'l', component: 'Text', text: 'Send' },
    ]));
    expect(document.querySelector('[data-a2ui-panel]')).toBeNull();
  });
  it('does not mark an unweighted column, or a weighted one that is not the row\'s own child', () => {
    const { feed } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Row', children: ['a', 'b'] },
      { id: 'a', component: 'Column', children: ['at'] }, { id: 'at', component: 'Text', text: 'Plain' },
      { id: 'b', component: 'Column', weight: 1, children: ['inner'] },
      { id: 'inner', component: 'Column', weight: 1, children: ['it'] }, { id: 'it', component: 'Text', text: 'Inner' },
    ]));
    expect(panel('Plain')).toBeNull();
    expect(screen.getByText('Inner').closest('[data-a2ui-panel]')?.contains(screen.getByText('Inner').closest('.sg-stack')!.parentElement!)).toBe(true);
    expect(document.querySelectorAll('[data-a2ui-panel]')).toHaveLength(1);
  });
  it('decides again when a panel arrives late', () => {
    const { feed } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'Row', children: ['a', 'b'] }, { id: 'b', component: 'Text', text: 'Later' }]));
    feed(components(v, [{ id: 'a', component: 'Column', weight: 1, children: ['at'] }, { id: 'at', component: 'Text', text: 'Editor' }]));
    expect(panel('Editor')).not.toBeNull();
  });
  it('gives a list room for its cards\' shadows, on the spacing scale', () => {
    const { feed, container } = mount();
    feed(create(v), components(v, [{ id: 'root', component: 'List', children: ['t'] }, { id: 't', component: 'Text', text: 'Item' }]));
    const list = container.querySelector<HTMLElement>('[role="list"]')!;
    expect(list.style.padding).toBe('4px');
    expect(list.style.margin).toBe('-4px');
    expect(list.style.gap).toBe('var(--sg-space-3, 12px)');
  });
});
