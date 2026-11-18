// The full verification run (vite preview of apps/docs/dist on :4173). `pnpm e2e` builds first.
//   1. render matrix: theme × contrast × reduce transparency × reduce motion, every page, desktop + phone — 3 engines
//   2. interactions: default settings in 3 engines + motion personalities and dark/high-contrast/reduced variants
//   3. reduced motion: in-app toggle and system setting — 3 engines
//   4. edge cases: rapid repeats, mid-animation changes, bounds, disabled/refused, long text, touch, keyboard,
//      320 px reflow, open/close leftovers, axe — 3 engines
//   5. performance (CPU ×4), momentum across updates, arrival timing (informational)
//
// The functional suites (1–4) run side by side — each in its own browser process, sharing only the preview
// server — so the run takes about as long as its longest few suites. Each suite's output is held back and printed
// whole when it ends (in full when it failed, its last line when it passed). The timing-sensitive suites (5) run
// afterwards, one at a time, on an otherwise idle machine.
//
// Environment:
//   E2E_JOBS=6               how many suites run at once (default: half the CPU cores, at most 8)
//   E2E_ENGINES=chromium     only these engines (comma-separated) — `pnpm e2e:quick` while iterating
//   E2E_ONLY=overflow        only suites whose label contains this text (the timing suites are skipped then)
//   E2E_VERBOSE=1            print every suite's full output
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';

const ENGINES = (process.env.E2E_ENGINES || 'chromium,webkit,firefox').split(',').map((s) => s.trim()).filter(Boolean);
const QUICK = !ENGINES.includes('webkit') || !ENGINES.includes('firefox');
const ONLY = process.env.E2E_ONLY || '';
const JOBS = Math.max(1, Number(process.env.E2E_JOBS) || Math.min(8, Math.floor(availableParallelism() / 2)));
const VERBOSE = !!process.env.E2E_VERBOSE;

/* label, script, env — the longest suites first, so the pool never waits on one late starter */
const suites = [];
const perEngine = (label, file) => { for (const b of ENGINES) suites.push([`${label} · ${b}`, file, { BROWSER: b }]); };
const variants = (label, file, qs) => { if (!QUICK) for (const q of qs) suites.push([`${label} · chromium ${q}`, file, { Q: q }]); };
perEngine('edge cases', 'edge.mjs');
perEngine('interactions', 'interact.mjs');
variants('interactions', 'interact.mjs', ['?motion=calm', '?motion=playful', '?mode=dark&hc=1&rt=1', '?mode=light&hc=1']);
perEngine('render matrix', 'matrix.mjs');
perEngine('selection components', 'selection.mjs');
variants('selection components', 'selection.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine('display & media', 'display.mjs');
variants('display & media', 'display.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine('dashboard', 'dashboard.mjs');
variants('dashboard', 'dashboard.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine('reduced motion', 'reduce-motion.mjs');
perEngine('many items (overflowing segmented / tab bar)', 'overflow.mjs');
const solo = ONLY ? [] : [
  ['performance (Chromium, CPU ×4)', 'perf.mjs', {}],
  ['progress keeps momentum across updates', 'progress-tick.mjs', {}],
  ['arrival timing per personality (informational)', 'timing.mjs', {}],
];
const picked = suites.filter(([label]) => !ONLY || label.includes(ONLY));

const results = [];
const secs = (t) => `${((performance.now() - t) / 1000).toFixed(0)}s`;
const run = ([label, file, env]) => new Promise((res) => {
  const t = performance.now(), out = [];
  const c = spawn('node', [`tests/e2e/${file}`], { env: { ...process.env, ...env } });
  c.stdout.on('data', (d) => out.push(d)); c.stderr.on('data', (d) => out.push(d));
  c.on('exit', (n) => {
    const pass = n === 0, text = Buffer.concat(out).toString().trimEnd();
    console.log(`\n=== ${pass ? 'PASS' : 'FAIL'}  ${label}  (${secs(t)})`);
    if (VERBOSE || !pass) console.log(text);
    else console.log(text.split('\n').pop());
    results.push([label, pass]); res();
  });
});
const pool = async (list, n) => {
  const queue = [...list];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));
};

const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: new URL('../../apps/docs/', import.meta.url), stdio: 'ignore' });
const t0 = performance.now();
try {
  await wait(1500);
  console.log(`${picked.length} suites, ${JOBS} at a time (${ENGINES.join(', ')})${solo.length ? `, then ${solo.length} timing suites alone` : ''}`);
  await pool(picked, JOBS);
  for (const s of solo) await run(s);
} finally { preview.kill(); }
console.log(`\n=== summary (${secs(t0)})`);
for (const [l, okk] of results) console.log(`${okk ? 'PASS' : 'FAIL'}  ${l}`);
const bad = results.filter(([, okk]) => !okk).length;
console.log(bad ? `${bad} suite(s) failed` : `all ${results.length} suites passed${QUICK ? ' (quick: not every engine)' : ''}`);
process.exit(bad ? 1 : 0);
