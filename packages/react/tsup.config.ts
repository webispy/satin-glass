import { defineConfig } from 'tsup';
const CATEGORIES = ['foundation', 'controls', 'layout', 'navigation', 'selection', 'overlays', 'feedback', 'data'];
export default defineConfig({
  /* the root entry has everything; each category is also its own entry (`@satin-glass/react/charts` …). Shared code
     lands in chunks, so an app that imports two entries does not load anything twice */
  entry: { index: 'src/index.ts', ...Object.fromEntries(CATEGORIES.map((c) => [c, `src/entries/${c}.ts`])) },
  format: ['esm'], dts: true, clean: true, sourcemap: true, splitting: true,
  external: ['react', 'react-dom', '@satin-glass/core', '@satin-glass/tokens'],
  banner: { js: "'use client';" },
});
