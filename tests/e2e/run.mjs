// Builds nothing; serves apps/docs/dist with vite preview, runs the interaction suite in three engines and the perf suite.
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: new URL('../../apps/docs/', import.meta.url), stdio: 'ignore' });
let code = 0;
const run = (args, env = {}) => new Promise((res) => {
  const c = spawn('node', args, { stdio: 'inherit', env: { ...process.env, ...env } });
  c.on('exit', (n) => { if (n) code = n; res(); });
});
try {
  await wait(1500);
  for (const b of ['chromium', 'webkit', 'firefox']) { console.log(`\n=== interactions · ${b}`); await run(['tests/e2e/interact.mjs'], { BROWSER: b }); }
  console.log('\n=== performance (Chromium, CPU ×4)'); await run(['tests/e2e/perf.mjs']);
} finally { preview.kill(); }
process.exit(code);
