import { defineConfig } from 'tsup';
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'], dts: true, clean: true, sourcemap: true,
  external: ['react', 'react-dom', 'zod', '@a2ui/react', '@a2ui/web_core', '@satin-glass/react'],
  banner: { js: "'use client';" },
});
