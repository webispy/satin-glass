// What changed, for `pnpm test:changed` and `pnpm e2e:changed`.
//
// Base: `--base <ref>` or E2E_BASE / TEST_BASE; otherwise the merge base with main on a branch, and HEAD on main
// (that is, what is not committed yet). Uncommitted and untracked files always count.
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

export function changedFiles(argv = process.argv.slice(2), envBase) {
  const i = argv.indexOf('--base');
  let base = i >= 0 ? argv[i + 1] : envBase;
  if (!base) {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    base = branch === 'main' ? 'HEAD' : git('merge-base', 'main', 'HEAD');
  }
  const files = new Set([
    ...git('diff', '--name-only', base).split('\n'),
    ...git('ls-files', '--others', '--exclude-standard').split('\n'),
  ].filter(Boolean));
  return { base, files: [...files].sort() };
}
