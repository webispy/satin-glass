import { act, fireEvent, screen } from '@testing-library/react';
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
