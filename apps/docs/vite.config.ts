import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/* the library's version, shown in the sidebar (one source: the react package) */
const version = JSON.parse(readFileSync(new URL('../../packages/react/package.json', import.meta.url), 'utf8')).version;

export default defineConfig({ plugins: [react()], base: './', server: { port: 5173 }, define: { __SG_VERSION__: JSON.stringify(version) } });
