/* Builds A2UI envelopes in either protocol version's syntax, and mounts a session with its surfaces. */
import { act, render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@satin-glass/react';
import { A2uiSurfaces, useA2ui, type A2uiOptions, type A2uiSession } from '../src';
import { BASIC_CATALOG_IDS } from '../src/catalogs';

export type V = '1.0' | '0.9';
export const wire = (v: V) => (v === '1.0' ? '1.0' : 'v0.9');
export const path = (v: V, p: string) => (v === '1.0' ? { '@path': p } : { path: p });
export const call = (v: V, name: string, args: Record<string, unknown>) => (v === '1.0' ? { '@call': name, args } : { call: name, args });
export const checks = (v: V, list: { condition: unknown; message: string }[]) => ({ [v === '1.0' ? '@checks' : 'checks']: list });
export const a11y = (v: V, label: string) => ({ [v === '1.0' ? '@accessibility' : 'accessibility']: { label } });

export const create = (v: V, surfaceId = 's', extra: Record<string, unknown> = {}) =>
  ({ version: wire(v), createSurface: { surfaceId, catalogId: BASIC_CATALOG_IDS[v], sendDataModel: true, ...extra } });
export const components = (v: V, list: Record<string, unknown>[], surfaceId = 's') =>
  ({ version: wire(v), updateComponents: { surfaceId, components: list } });
export const data = (v: V, value: unknown, surfaceId = 's', p?: string) =>
  ({ version: wire(v), updateDataModel: { surfaceId, ...(p ? { path: p } : {}), value } });
export const remove = (v: V, surfaceId = 's') => ({ version: wire(v), deleteSurface: { surfaceId } });

export type Mounted = { container: HTMLElement; feed: (...messages: unknown[]) => void; session: () => A2uiSession; rerenderWith: (opts: A2uiOptions, lang?: string) => void; unmount: () => void };
export function mount(options: A2uiOptions = {}, lang = 'en'): Mounted {
  const box: { a2ui?: A2uiSession } = {};
  function App({ opts }: { opts: A2uiOptions }) {
    const a2ui = useA2ui(opts);
    box.a2ui = a2ui;
    return <A2uiSurfaces a2ui={a2ui} />;
  }
  const r = render(<ThemeProvider theme={createTheme({ locale: lang })}><App opts={options} /></ThemeProvider>);
  const feed = (...messages: unknown[]) => act(() => { box.a2ui!.process(messages); });
  return { container: r.container, unmount: r.unmount, feed, session: () => box.a2ui!, rerenderWith: (opts: A2uiOptions, l = lang) => r.rerender(<ThemeProvider theme={createTheme({ locale: l })}><App opts={opts} /></ThemeProvider>) };
}

/* a frame for requestAnimationFrame callbacks */
export const frame = () => act(() => new Promise<void>((res) => requestAnimationFrame(() => res())));

/* a tick: field check messages show once focus has settled after a blur */
export const tick = () => act(() => new Promise<void>((res) => setTimeout(res, 0)));
