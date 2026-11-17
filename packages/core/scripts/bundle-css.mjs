// dist/styles.css = tokens + base + material + controls + navigation + overlays (one file, one request)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tokens = readFileSync(require.resolve('@glass-layer/tokens/tokens.css'), 'utf8');
const parts = ['base', 'material', 'controls', 'selection', 'navigation', 'overlays', 'display', 'data'].map((n) => readFileSync(new URL(`../styles/${n}.css`, import.meta.url), 'utf8'));
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
const css = [tokens, ...parts].join('\n');
writeFileSync(new URL('../dist/styles.css', import.meta.url), css);
console.log(`styles.css ${(css.length / 1024).toFixed(1)} KB`);
