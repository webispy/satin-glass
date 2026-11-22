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
//   concentric corners: boxes nested near a corner follow inner = outer − gap (Chromium)
//   focus visible: Tab through each page; the focused area must change, in all themes and forced colours (Chromium)
//   settings at the nearest boundary: nested themes, high contrast, reduced motion, reduce transparency in portals
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
//   E2E_FILES=a.mjs,b.mjs             only these suites, every engine and variant; E2E_BROAD=c.mjs: these only once,
//                                     in Chromium. Set by `pnpm e2e:changed` (tests/e2e/changed.mjs); timing skipped
//   E2E_VERBOSE=1                     print every suite's full output
//   E2E_TIMING=0                      skip the timing phase (performance, momentum, arrival timing): CI
//   E2E_SHARD=2/4                     run only the 2nd of 4 shares of the suites (CI: one share per runner)
//   E2E_LIST=1                        print the suites that would run, with their estimated time, and stop
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';

const ENGINES = (process.env.E2E_ENGINES || 'chromium,webkit,firefox').split(',').map((s) => s.trim()).filter(Boolean);
const QUICK = !ENGINES.includes('webkit') || !ENGINES.includes('firefox');
const ONLY = process.env.E2E_ONLY || '';
const list = (v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : null);
const FILES = list(process.env.E2E_FILES), BROAD = list(process.env.E2E_BROAD), PICKED = !!(FILES || BROAD);
const JOBS = Math.max(1, Number(process.env.E2E_JOBS) || Math.min(16, availableParallelism() - 2));
const MOTION_JOBS = Math.max(1, Number(process.env.E2E_MOTION_JOBS) || Math.min(8, JOBS));
const VERBOSE = !!process.env.E2E_VERBOSE;

/* [label, script, env]; within a phase the longest suites first, so the pool never waits on one late starter */
const checks = [], motion = [];
const perEngine = (to, label, file) => { for (const b of ENGINES) to.push([`${label} · ${b}`, file, { BROWSER: b }]); };
const variants = (to, label, file, qs) => { if (!QUICK) for (const q of qs) to.push([`${label} · chromium ${q}`, file, { Q: q }]); };
/* the render matrix: chromium checks all 16 setting combos, the others the 8 visual ones — ~4 combos per shard */
const sharded = (to, label, file, shardsFor) => { for (const b of ENGINES) { const n = shardsFor(b); for (let i = 1; i <= n; i++) to.push([`${label} · ${b}${n > 1 ? ` ${i}/${n}` : ''}`, file, { BROWSER: b, SHARD: `${i}/${n}` }]); } };

/* the strips' browsing (wheel latching, pan, fling) depends on real time between events: its own run, in the motion phase */
for (const b of ENGINES) checks.push([`many items (overflowing segmented / tab bar) · ${b}`, 'overflow.mjs', { BROWSER: b, OVF_PART: 'checks' }]);
for (const b of ENGINES) motion.push([`strip browsing (wheel, pan, fling) · ${b}`, 'overflow.mjs', { BROWSER: b, OVF_PART: 'browse' }]);
perEngine(checks, 'edge cases', 'edge.mjs');
sharded(checks, 'render matrix', 'matrix.mjs', (b) => (b === 'chromium' ? 4 : 2));
perEngine(checks, 'data components & dashboard', 'data.mjs');
perEngine(checks, 'settings decide at the nearest boundary', 'settings.mjs');
/* the cascade is the same in every engine: the per-category stylesheet check runs once, in Chromium */
/* the longest suite, in three parts by page so they can run side by side */
if (ENGINES.includes('chromium')) for (let i = 1; i <= 3; i++) checks.push([`stylesheets split by category · chromium ${i}/3`, 'css-split.mjs', { E2E_PART: `${i}/3` }]);
/* nested corners stay concentric (design-language.md 9): a static layout check, once, in Chromium */
if (ENGINES.includes('chromium')) checks.push(['concentric corners · chromium', 'corners.mjs', {}]);
perEngine(checks, 'blur budget', 'blur-budget.mjs');
/* keyboard focus visible in every theme and with forced colours (emulated in Chromium) */
if (ENGINES.includes('chromium')) checks.push(['focus visible · chromium', 'focus.mjs', {}]);
variants(checks, 'data components & dashboard', 'data.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);

perEngine(motion, 'interactions', 'interact.mjs');
variants(motion, 'interactions', 'interact.mjs', ['?motion=calm', '?motion=playful', '?mode=dark&hc=1&rt=1', '?mode=light&hc=1']);
perEngine(motion, 'display & media', 'display.mjs');
variants(motion, 'display & media', 'display.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine(motion, 'selection components', 'selection.mjs');
variants(motion, 'selection components', 'selection.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine(motion, 'wheels, time & weekdays, navigation stack', 'pickers.mjs');
perEngine(motion, 'wheel lens motion (squeeze, knocks, pop)', 'wheel-motion.mjs');
perEngine(motion, 'date ranges', 'range.mjs');
variants(motion, 'date ranges', 'range.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine(motion, '0.5 components', 'v05.mjs');
variants(motion, '0.5 components', 'v05.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
variants(motion, 'wheels, time & weekdays, navigation stack', 'pickers.mjs', ['?motion=playful', '?mode=dark&hc=1&rt=1', '?rm=1']);
perEngine(motion, 'reduced motion', 'reduce-motion.mjs');
/* finger drags with real touch input (CDP: Chromium only), in the motion phase — they follow the finger frame by frame */
if (ENGINES.includes('chromium')) motion.push(['finger drags (touch) · chromium', 'touch.mjs', {}]);

/* E2E_TIMING=0: skip the timing phase (CI runners are shared machines; their timings say little) */
const timing = ONLY || PICKED || process.env.E2E_TIMING === '0' ? [] : [
  ['performance (Chromium, CPU ×4)', 'perf.mjs', {}],
  ['progress keeps momentum across updates', 'progress-tick.mjs', {}],
  ['arrival timing per personality (informational)', 'timing.mjs', {}],
];
const only = (l) => l.filter(([label, file, env]) => {
  if (ONLY && !label.includes(ONLY)) return false;
  if (!PICKED || FILES?.includes(file)) return true;
  return !!BROAD?.includes(file) && (env.BROWSER ?? 'chromium') === 'chromium' && !env.Q;
});

/* E2E_SHARD=k/n: this machine runs the k-th of n shares (CI runs the shares on separate runners). Suites go,
   longest first, to the share with the least so far, by the time each took on a CI runner (Chromium; other
   engines a third longer); every runner computes the same split */
const EST = { 'css-split.mjs': 126, 'focus.mjs': 174, 'edge.mjs': 102, 'overflow.mjs': 95, 'overflow.mjs#browse': 15, 'matrix.mjs': 67, 'interact.mjs': 59, 'data.mjs': 57,
  'corners.mjs': 51, 'reduce-motion.mjs': 49, 'pickers.mjs': 37, 'wheel-motion.mjs': 33, 'display.mjs': 32, 'selection.mjs': 28,
  'blur-budget.mjs': 23, 'touch.mjs': 23, 'range.mjs': 15, 'v05.mjs': 45, 'settings.mjs': 4 };
const SHARD = /^(\d+)\/(\d+)$/.exec(process.env.E2E_SHARD || '');
const est = ([, file, env]) => (EST[env.OVF_PART === 'browse' ? 'overflow.mjs#browse' : file] ?? 60) * ((env.BROWSER ?? 'chromium') === 'chromium' ? 1 : 1.3);
let mine = null;
if (SHARD) {
  const k = +SHARD[1], n = +SHARD[2], load = Array(n).fill(0);
  mine = new Set();
  for (const s of [...only(checks), ...only(motion)].sort((a, b) => est(b) - est(a))) {
    const i = load.indexOf(Math.min(...load)); load[i] += est(s);
    if (i === k - 1) mine.add(s[0]);
  }
}
const share = (l) => (mine ? l.filter((s) => mine.has(s[0])) : l);

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

if (process.env.E2E_LIST) {
  /* E2E_LIST=1: print what would run (with the estimates), start nothing */
  const l = [...share(only(checks)), ...share(only(motion))];
  for (const x of l) console.log(`${String(Math.round(est(x))).padStart(4)}s  ${x[0]}`);
  console.log(`${l.length} suites, ~${Math.round(l.reduce((t, x) => t + est(x), 0))}s of suite time`);
  process.exit(0);
}
const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: new URL('../../apps/docs/', import.meta.url), stdio: 'ignore' });
const t0 = performance.now();
try {
  await wait(1500);
  console.log(`engines: ${ENGINES.join(', ')}`);
  if (SHARD) console.log(`shard ${SHARD[1]} of ${SHARD[2]}: ${mine.size} suites`);
  await phase('1/3 checks', share(only(checks)), JOBS);
  await phase('2/3 motion', share(only(motion)), MOTION_JOBS);
  if (timing.length && (!SHARD || SHARD[1] === '1')) {
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
