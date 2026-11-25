// @vitest-environment node
/* in node, as a server renders: no window, no document */
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from '@satin-glass/react';
import { A2uiSurfaces, useA2ui } from '../src';

it('imports and renders on the server, with no surfaces and no window', () => {
  expect(typeof window).toBe('undefined');
  function App() { const a2ui = useA2ui(); return <A2uiSurfaces a2ui={a2ui} />; }
  const html = renderToString(<ThemeProvider><App /></ThemeProvider>);
  expect(html).toMatch(/role="region"/);
  expect(html).toMatch(/aria-label="Agent content"/);
});
