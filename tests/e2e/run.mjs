// The full verification run (vite preview of apps/docs/dist on :4173). `pnpm e2e` builds first.
//
// What it checks:
//   render matrix: theme × contrast × reduce transparency × reduce motion, every page, desktop + phone
//   interactions, selection, display, data components & dashboard, many-item strips, wheels / time / weekdays /
//     navigation stack: behaviour of every component
//   reduced motion: in-app toggle and system setting
//   finger drags with real touch input: sheet, switch, slider, segmented control, tab bar, wheel fling, swipe back (Chromium)
//   edge cases: rapid repeats, mid-animation changes, bounds, disabled/refused, long text, touch, keyboard,
//     320 px reflow, open/close leftovers, axe
//   stylesheets split by category: every page computes the same with the per-category files in any order, with
//     each category's listed dependencies only, and with the layered build (Chromium)
//   performance (CPU ×4), momentum across updates, arrival timing (informational)
// Everything runs in all three engines (Chromium, WebKit, Firefox); the variants (motion personalities, dark / high
// contrast / reduced transparency, reduced motion) in Chromium.
//
// How — three phases, by how much a suite cares about the machine being busy:
//   1. checks   suites that only look at results (render matrix in shards, edge cases, many-item strips, data &
//               dashboard): every wait in them is "until it settles" or generous, so they run many at once
//               (E2E_JOBS, default CPU cores − 2, at most 16), all engines side by side.
//   2. motion   suites that also measure animation as it happens (frames drawn, how soon a menu opens, how a
//               selection slides): fewer at once (E2E_MOTION_JOBS, default 8), still all engines side by side.
//   3. timing   performance and timing suites: one at a time, after a pause for the machine to go quiet. A timing
//               suite that fails runs once more — a real regression fails twice, a one-off stall does not; the
//               summary says when a pass needed the second run.
// Each suite's output is held back and printed whole when it ends (in full when it failed, its last line otherwise).
//
// Environment:
//   E2E_JOBS=16 / E2E_MOTION_JOBS=8   how many suites run at once in phases 1 and 2
//   E2E_ENGINES=chromium              only these engines (comma-separated) — `pnpm e2e:quick` while iterating
//   E2E_ONLY=overflow                 only suites whose label contains this text (the timing phase is skipped then)
//   E2E_VERBOSE=1                     print every suite's full output
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';

const ENGINES = (process.env.E2E_ENGINES || 'chromium,webkit,firefox').split(',').map((s) => s.trim()).filter(Boolean);
const QUICK = !ENGINES.includes('webkit') || !ENGINES.includes('firefox');
const ONLY = process.env.E2E_ONLY || '';
const JOBS = Math.max(1, Number(process.env.E2E_JOBS) || Math.min(16, availableParallelism() - 2));
const MOTION_JOBS = Math.max(1, Number(process.env.E2E_MOTION_JOBS) || Math.min(8, JOBS));
const VERBOSE = !!process.env.E2E_VERBOSE;

/* [label, script, env]; within a phase the longest suites first, so the pool never waits on one late starter */
const checks = [], motion = [];
const perEngine = (to, label, file) => { for (const b of ENGINES) to.push([`${label} · ${b}`, file, { BROWSER: b }]); };
const variants = (to, label, file, qs) => { if (!QUICK) for (const q of qs) to.push([`${label} · chromium ${q}`, file, { Q: q }]); };
/* the render matrix: chromium checks all 16 setting combos, the others the 8 visual ones — ~4 combos per shard */
const sharded = (to, label, file, shardsFor) => { for (const b of ENGINES) { const n = shardsFor(b); for (let i = 1; i <= n; i++) to.push([`${label} · ${b}${n > 1 ? ` ${i}/${n}` : ''}`, file, { BROWSER: b, SHARD: `${i}/${n}` }]); } };

perEngine(checks, 'many items (overflowing segmented / tab bar)', 'overflow.mjs');
perEngine(checks, 'edge cases', 'edge.mjs');
sharded(checks, 'render matrix', 'matrix.mjs', (b) => (b === 'chromium' ? 4 : 2));
perEngine(checks, 'data components & dashboard', 'data.mjs');
/* the cascade is the same in every engine: the per-category stylesheet check runs once, in Chromium */
if (ENGINES.includes('chromium')) checks.push(['stylesheets split by category · chromium', 'css-split.mjs', {}]);
variants(checks, 'data components & dashboard', 'data.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);

perEngine(motion, 'interactions', 'interact.mjs');
variants(motion, 'interactions', 'interact.mjs', ['?motion=calm', '?motion=playful', '?mode=dark&hc=1&rt=1', '?mode=light&hc=1']);
perEngine(motion, 'display & media', 'display.mjs');
variants(motion, 'display & media', 'display.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine(motion, 'selection components', 'selection.mjs');
variants(motion, 'selection components', 'selection.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine(motion, 'wheels, time & weekdays, navigation stack', 'pickers.mjs');
variants(motion, 'wheels, time & weekdays, navigation stack', 'pickers.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine(motion, 'reduced motion', 'reduce-motion.mjs');
/* finger drags with real touch input (CDP: Chromium only), in the motion phase — they follow the finger frame by frame */
if (ENGINES.includes('chromium')) motion.push(['finger drags (touch) · chromium', 'touch.mjs', {}]);

const timing = ONLY ? [] : [
  ['performance (Chromium, CPU ×4)', 'perf.mjs', {}],
  ['progress keeps momentum across updates', 'progress-tick.mjs', {}],
  ['arrival timing per personality (informational)', 'timing.mjs', {}],
];
const only = (list) => list.filter(([label]) => !ONLY || label.includes(ONLY));

const results = [];
const secs = (t) => `${((performance.now() - t) / 1000).toFixed(0)}s`;
const run = ([label, file, env], record = true) => new Promise((res) => {
  const t = performance.now(), out = [];
  const c = spawn('node', [`tests/e2e/${file}`], { env: { ...process.env, ...env } });
  c.stdout.on('data', (d) => out.push(d)); c.stderr.on('data', (d) => out.push(d));
  c.on('exit', (n) => {
    const pass = n === 0, text = Buffer.concat(out).toString().trimEnd();
    console.log(`\n=== ${pass ? 'PASS' : 'FAIL'}  ${label}  (${secs(t)})`);
    if (VERBOSE || !pass) console.log(text);
    else console.log(text.split('\n').pop());
    if (record) results.push([label, pass]);
    res(pass);
  });
});
const pool = async (list, n) => {
  const queue = [...list];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));
};
const phase = async (name, list, n) => {
  if (!list.length) return;
  const t = performance.now();
  console.log(`\n##### ${name}: ${list.length} suites, ${n} at a time`);
  await pool(list, n);
  console.log(`\n##### ${name} done in ${secs(t)}`);
};

const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: new URL('../../apps/docs/', import.meta.url), stdio: 'ignore' });
const t0 = performance.now();
try {
  await wait(1500);
  console.log(`engines: ${ENGINES.join(', ')}`);
  await phase('1/3 checks', only(checks), JOBS);
  await phase('2/3 motion', only(motion), MOTION_JOBS);
  if (timing.length) {
    console.log('\n##### 3/3 timing: one at a time');
    await wait(5000);
    for (const s of timing) {
      if (await run(s, false)) { results.push([s[0], true]); continue; }
      console.log(`    … running "${s[0]}" once more (a timing suite can be thrown by a one-off stall)`);
      const again = await run(s, false);
      results.push([`${s[0]}${again ? ' (passed on the second run)' : ''}`, again]);
    }
  }
} finally { preview.kill(); }
console.log(`\n=== summary (${secs(t0)})`);
for (const [l, okk] of results) console.log(`${okk ? 'PASS' : 'FAIL'}  ${l}`);
const bad = results.filter(([, okk]) => !okk).length;
console.log(bad ? `${bad} suite(s) failed` : `all ${results.length} suites passed${QUICK ? ' (quick: not every engine)' : ''}`);
process.exit(bad ? 1 : 0);
