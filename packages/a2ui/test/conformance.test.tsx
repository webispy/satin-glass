/* A2UI's own basic catalog examples, both versions (fixtures/README.md): each renders with no protocol error, no
   component outside the catalog, and every surface drawn. Actions on their buttons resolve and reach onOutbound. */
import { act, fireEvent } from '@testing-library/react';
import type { A2uiReport } from '../src';
import { mount } from './helpers';

const files = import.meta.glob<{ messages: unknown[] }>('./fixtures/*/*.json', { eager: true, import: 'default' });
const cases = Object.keys(files).sort().map((k) => [k.replace('./fixtures/', ''), files[k]] as const);

describe.each(cases)('%s', (_name, { messages }) => {
  it('renders with no error, and its buttons send actions', async () => {
    const reports: A2uiReport[] = [];
    const sent: unknown[] = [];
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, session } = mount({ onReport: (r) => reports.push(r), onOutbound: (m) => { sent.push(m); }, icons: new Proxy({}, { get: () => '•' }) as Record<string, string> });
    act(() => session().process(messages));
    /* a binding to data the example never sends is a warning, not an error: the scaffold examples have no data */
    const problems = reports.filter((r) => (r.kind !== 'diagnostic' || r.code === 'refused-url') && !(r.kind === 'warning' && r.warning.code === 'MISSING_DATA_BINDING'));
    expect(problems.map((r) => (r.kind === 'error' ? r.error.code + ': ' + r.error.message : r.kind === 'warning' ? r.warning.code + ': ' + r.warning.message : r.message))).toEqual([]);
    expect(session().surfaces.length).toBeGreaterThan(0);
    expect(container.textContent!.length + container.querySelectorAll('img, svg, input, video, audio').length).toBeGreaterThan(0);
    /* every enabled button is pressed: no error follows, and a fixture with an agent action that no check blocks
       sends at least one action to the transport */
    for (const b of [...container.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]) {
      if (!b.isConnected || b.disabled) continue;
      await act(async () => { fireEvent.click(b); await Promise.resolve(); });
    }
    const after = reports.filter((r) => r.kind === 'error');
    expect(after.map((r) => (r.kind === 'error' ? `${r.error.code}: ${r.error.message}` : ''))).toEqual([]);
    const buttons = JSON.stringify(messages).match(/"component":"Button"[^}]*"action":\{"event"/g) ?? [];
    const unblocked = (messages as { updateComponents?: { components: Record<string, unknown>[] }; createSurface?: { components?: Record<string, unknown>[] } }[])
      .flatMap((m) => m.updateComponents?.components ?? m.createSurface?.components ?? [])
      .some((c) => c.component === 'Button' && (c.action as { event?: unknown } | undefined)?.event && !c.checks && !c['@checks']);
    if (buttons.length && unblocked) expect(sent.some((m) => (m as { action?: unknown }).action)).toBe(true);
    /* every action sent is one the fixture declares, from the button that declares it, on a surface it created */
    const comps = (messages as { updateComponents?: { components: Record<string, unknown>[] }; createSurface?: { surfaceId: string; components?: Record<string, unknown>[] } }[])
      .flatMap((m) => m.updateComponents?.components ?? m.createSurface?.components ?? []);
    const declared = new Map(comps.filter((c) => (c.action as { event?: { name?: string } } | undefined)?.event?.name)
      .map((c) => [c.id as string, (c.action as { event: { name: string } }).event.name]));
    const surfaces = new Set((messages as { createSurface?: { surfaceId: string } }[]).flatMap((m) => (m.createSurface ? [m.createSurface.surfaceId] : [])));
    for (const m of sent as { action?: { name: string; sourceComponentId: string; surfaceId: string } }[]) {
      if (!m.action) continue;
      expect(surfaces.has(m.action.surfaceId)).toBe(true);
      /* a button inside a list template has an instance ID: its declared component is the part before the index */
      const own = declared.get(m.action.sourceComponentId) ?? [...declared].find(([id]) => m.action!.sourceComponentId.startsWith(id))?.[1];
      expect(own).toBe(m.action.name);
    }
    expect(warn.mock.calls.filter((c) => !String(c[0]).includes('not wrapped in act'))).toEqual([]);
    warn.mockRestore();
  });
});

/* the check above would catch a broken payload: a component outside the catalog, and an update to a surface that was
   never created, are reported. (A call to a function outside the catalog is not: web_core 0.16.1 renders nothing for
   it and says nothing; noted on #62.) */
it('reports a component outside the catalog and an update to a surface that does not exist', () => {
  const reports: A2uiReport[] = [];
  const { session } = mount({ onReport: (r) => reports.push(r) });
  act(() => session().process([
    { version: '1.0', createSurface: { surfaceId: 'x', catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json' } },
    { version: '1.0', updateComponents: { surfaceId: 'x', components: [{ id: 'root', component: 'Gizmo' }] } },
  ]));
  act(() => session().process([
    { version: '1.0', updateComponents: { surfaceId: 'y', components: [{ id: 'root', component: 'Text', text: 'orphan' }] } },
  ]));
  const errors = reports.flatMap((r) => (r.kind === 'error' ? [`${r.error.surfaceId}: ${r.error.code}`] : []));
  expect(errors.some((e) => e.startsWith('x:'))).toBe(true);
  expect(errors.some((e) => e.startsWith('y:'))).toBe(true);
});
