// Checks commit messages against CONTRIBUTING.md, so a missing sign-off or a malformed trailer is caught when the
// commit is made (the commit-msg hook) or at the latest when it is pushed (CI), not noticed weeks later.
//   node scripts/check-commits.mjs --msg <file>     one message being committed (.githooks/commit-msg)
//   node scripts/check-commits.mjs <from>..<to>     every commit in a range (CI); also refuses wip/fixup! subjects
// Checks: the subject is `<area>: <summary>` (lower case after the colon, no full stop, at most 72 characters); one
// blank line before the body; body lines wrap at 72 (indented lines, URLs and trailers excepted); a Signed-off-by
// from the author; every Reviewed-by / Co-Authored-By names someone with an address in angle brackets.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const PERSON = /^.+ <[^<>\s@]+@[^<>\s]+>$/;

function check(msg, author, { range }) {
  const errs = [];
  const lines = msg.replace(/\r/g, '').split('\n').filter((l) => !l.startsWith('#'));
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const [subject = '', blank, ...body] = lines;
  if (range && /^(fixup!|squash!|amend!|wip\b)/i.test(subject)) errs.push('a fixup/wip commit: fold it into the commit it belongs to before pushing');
  else if (!/^(fixup!|squash!|amend!|wip\b)/i.test(subject)) {
    const m = subject.match(/^([^:]+): (.*)$/);
    if (!m) errs.push(`subject is not "<area>: <summary>": "${subject}"`);
    else {
      if (/^[A-Z]/.test(m[2]) && !/^[A-Z]{2,}|^[A-Z][a-z]+[A-Z]/.test(m[2])) errs.push('no capital after the colon (names like DataTable or README are fine)');
      if (/\.$/.test(m[2])) errs.push('no full stop at the end of the subject');
    }
    if (subject.length > 72) errs.push(`subject is ${subject.length} characters (at most 72)`);
  }
  if (blank !== undefined && blank.trim()) errs.push('one blank line between the subject and the body');
  const trailers = [], text = [];
  let inTrailers = false;
  for (let i = body.length - 1; i >= 0; i--) {   /* the trailer block is the last paragraph */
    if (!inTrailers && /^[A-Za-z-]+: /.test(body[i])) { trailers.unshift(body[i]); continue; }
    inTrailers = true; text.unshift(body[i]);
  }
  for (const l of text) if (l.length > 72 && !/^\s{2,}|https?:\/\//.test(l)) errs.push(`body line over 72 columns: "${l.slice(0, 40)}…"`);
  const signed = trailers.filter((t) => t.startsWith('Signed-off-by: ')).map((t) => t.slice(15));
  if (!signed.length) errs.push('no Signed-off-by (commit with -s)');
  else if (author && !signed.includes(author)) errs.push(`no Signed-off-by from the author (${author})`);
  for (const t of trailers) {
    const m = t.match(/^(Signed-off-by|Reviewed-by|Co-Authored-By|Co-authored-by|Acked-by|Tested-by|Reported-by): (.*)$/);
    if (m && !PERSON.test(m[2])) errs.push(`${m[1]} needs "Name <address>": "${m[2]}"`);
  }
  return errs;
}

const args = process.argv.slice(2);
let failed = 0;
if (args[0] === '--msg') {
  const me = (() => { try { return `${git('config', 'user.name')} <${git('config', 'user.email')}>`; } catch { return null; } })();
  const errs = check(readFileSync(args[1], 'utf8'), me, { range: false });
  for (const e of errs) console.error(`commit-msg: ${e}`);
  if (errs.length) { console.error('see CONTRIBUTING.md (Commits); the message was kept in .git/COMMIT_EDITMSG'); process.exit(1); }
} else if (args[0]) {
  const shas = git('rev-list', '--no-merges', '--reverse', args[0]).split('\n').filter(Boolean);
  for (const sha of shas) {
    const errs = check(git('log', '-1', '--format=%B', sha), git('log', '-1', '--format=%an <%ae>', sha), { range: true });
    if (errs.length) { failed++; console.log(`${sha.slice(0, 12)} ${git('log', '-1', '--format=%s', sha)}`); for (const e of errs) console.log(`  - ${e}`); }
  }
  console.log(failed ? `\n${failed} of ${shas.length} commit(s) need fixing (CONTRIBUTING.md, Commits)` : `${shas.length} commit(s) checked`);
  process.exit(failed ? 1 : 0);
} else {
  console.error('usage: check-commits.mjs --msg <file> | <from>..<to>');
  process.exit(2);
}
