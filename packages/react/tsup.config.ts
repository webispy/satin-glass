import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'], format: ['esm'], dts: true, clean: true, sourcemap: true,
  external: ['react', 'react-dom', '@satin-glass/core', '@satin-glass/tokens'],
  banner: { js: "'use client';" },
});
