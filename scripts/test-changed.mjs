// pnpm test:changed [--base <ref>] — unit tests for what changed.
// tokens -> core -> react -> a2ui: a change in a package runs the whole suite of every package that depends on it (they
// import its built output, which Vitest's import graph does not connect to the sources). A change confined to one
// package lets Vitest pick the affected test files itself (`vitest run --changed <base>`).
import { spawnSync } from 'node:child_process';
import { changedFiles } from './changed-files.mjs';

const { base, files } = changedFiles(process.argv.slice(2), process.env.TEST_BASE);
const PKGS = ['tokens', 'core', 'react', 'a2ui'];
const touched = (p) => files.some((f) => f.startsWith(`packages/${p}/`));
const first = PKGS.findIndex(touched);
console.log(`base ${base}: ${files.length} changed file(s)`);
if (first < 0) { console.log('no package changed: no unit tests to run'); process.exit(0); }

let failed = 0;
for (const [i, p] of PKGS.entries()) {
  if (i < first || p === 'tokens') continue;                       // tokens has no unit tests (its build checks contrast)
  /* a change to a package's own configuration (tsconfig, manifest, build) can affect every test of it */
  const config = files.some((f) => f.startsWith(`packages/${p}/`) && !/^packages\/[^/]+\/(src|test)\//.test(f));
  const upstream = PKGS.slice(0, i).some(touched) || config;
  if (!upstream && !touched(p)) continue;
  const args = upstream ? ['vitest', 'run'] : ['vitest', 'run', '--changed', base, '--passWithNoTests'];
  console.log(`\n> packages/${p}: ${upstream ? (config ? 'all tests (its configuration changed)' : 'all tests (a package it depends on changed)') : 'tests affected by the change'}`);
  const r = spawnSync('pnpm', ['exec', ...args], { cwd: `packages/${p}`, stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
