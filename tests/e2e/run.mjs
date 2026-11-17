// The full verification run (vite preview of apps/docs/dist on :4173). `pnpm e2e` builds first.
//   1. render matrix: theme × contrast × reduce transparency × reduce motion, every page, desktop + phone — 3 engines
//   2. interactions: default settings in 3 engines + motion personalities and dark/high-contrast/reduced variants
//   3. reduced motion: in-app toggle and system setting — 3 engines
//   4. edge cases: rapid repeats, mid-animation changes, bounds, disabled/refused, long text, touch, keyboard,
//      320 px reflow, open/close leftovers, axe — 3 engines
//   5. performance (CPU ×4), momentum across updates, arrival timing (informational)
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: new URL('../../apps/docs/', import.meta.url), stdio: 'ignore' });
const results = [];
const run = (label, args, env = {}) => new Promise((res) => {
  console.log(`\n=== ${label}`);
  const c = spawn('node', args, { stdio: 'inherit', env: { ...process.env, ...env } });
  c.on('exit', (n) => { results.push([label, n === 0]); res(); });
});
const ENGINES = ['chromium', 'webkit', 'firefox'];
try {
  await wait(1500);
  for (const b of ENGINES) await run(`render matrix · ${b}`, ['tests/e2e/matrix.mjs'], { BROWSER: b });
  for (const b of ENGINES) await run(`interactions · ${b}`, ['tests/e2e/interact.mjs'], { BROWSER: b });
  for (const q of ['?motion=calm', '?motion=playful', '?mode=dark&hc=1&rt=1', '?mode=light&hc=1']) await run(`interactions · chromium ${q}`, ['tests/e2e/interact.mjs'], { Q: q });
  for (const b of ENGINES) await run(`reduced motion · ${b}`, ['tests/e2e/reduce-motion.mjs'], { BROWSER: b });
  for (const b of ENGINES) await run(`edge cases · ${b}`, ['tests/e2e/edge.mjs'], { BROWSER: b });
  await run('performance (Chromium, CPU ×4)', ['tests/e2e/perf.mjs']);
  await run('progress keeps momentum across updates', ['tests/e2e/progress-tick.mjs']);
  await run('arrival timing per personality (informational)', ['tests/e2e/timing.mjs']);
} finally { preview.kill(); }
console.log('\n=== summary');
for (const [l, okk] of results) console.log(`${okk ? 'PASS' : 'FAIL'}  ${l}`);
const bad = results.filter(([, okk]) => !okk).length;
console.log(bad ? `${bad} suite(s) failed` : `all ${results.length} suites passed`);
process.exit(bad ? 1 : 0);
