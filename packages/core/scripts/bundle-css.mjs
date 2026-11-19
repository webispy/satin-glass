// dist/css/<category>.css — one file per category (foundation carries the design tokens), for apps that load only
//                            what they use
// dist/styles.css         — every category in one file (one request)
// dist/styles.layer.css   — the same inside `@layer satin-glass`, for apps that order their own layers (a CSS-in-JS
//                            or utility framework): unlayered app styles then win without specificity fights.
//                            @property rules stay outside the layer (they do not cascade, and not every engine
//                            accepts them inside one).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const CATEGORIES = ['foundation', 'controls', 'layout', 'navigation', 'selection', 'overlays', 'feedback', 'data'];
const tokens = readFileSync(require.resolve('@satin-glass/tokens/tokens.css'), 'utf8');
const src = (n) => readFileSync(new URL(`../styles/${n}.css`, import.meta.url), 'utf8');
const out = (p, s) => writeFileSync(new URL(`../dist/${p}`, import.meta.url), s);
mkdirSync(new URL('../dist/css/', import.meta.url), { recursive: true });

const files = CATEGORIES.map((n) => (n === 'foundation' ? tokens + '\n' + src(n) : src(n)));
CATEGORIES.forEach((n, i) => out(`css/${n}.css`, files[i]));
const all = files.join('\n');
out('styles.css', all);
const props = [];
const body = all.replace(/@property\s+[^{]+\{[^}]*\}\n?/g, (m) => { props.push(m.trim()); return ''; });
out('styles.layer.css', `${props.join('\n')}\n@layer satin-glass {\n${body}\n}\n`);
console.log(`styles.css ${(all.length / 1024).toFixed(1)} KB · ${CATEGORIES.map((n, i) => `${n} ${(files[i].length / 1024).toFixed(0)}`).join(' · ')} KB`);
