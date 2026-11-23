// pnpm e2e:changed [--base <ref>] [--dry] [--files a,b] — the e2e suites that cover what changed (`pnpm e2e` builds first).
//
// 1. Each changed file maps to library categories (foundation, controls, layout, navigation, selection, overlays,
//    feedback, data):
//      packages/react/src/<file>   the categories whose entry (src/entries/<category>.ts) re-exports it or a file
//                                  that imports it (directly or not)
//      packages/core/styles/<c>.css   that category
//      docs pages                  the categories they show (PAGES below); a page not listed there, the
//                                  categories of the library components it imports (foundation aside)
//      apps/docs/src/docs.css      the pages that use the classes on the changed lines (each line's rule
//                                  selector), then as those pages; a class used by the docs frame or by no
//                                  page, or a changed line outside any class rule, means everything
//    Anything the categories share — tokens, core's behaviour code, foundation, React helpers no entry names, the
//    docs app's frame, build files — and any file this script does not know means: run everything.
// 2. A changed stylesheet that others need (README table) pulls those in too: controls -> selection, data;
//    overlays -> selection; selection -> data.
// 3. Every suite says what it covers on a `// covers:` line. A suite runs in all three engines when it covers a
//    selected category or is itself changed. Suites that cover `*` (render matrix, edge cases, reduced motion) run
//    once, in Chromium, when anything in the library changed; `css` (the split-stylesheet check) when a stylesheet
//    did. The timing phase (performance) is left to the full run.
// Before a release the full `pnpm e2e` still runs: this is for checking work in progress quickly.
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { changedFiles } from '../../scripts/changed-files.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const CATS = ['foundation', 'controls', 'layout', 'navigation', 'selection', 'overlays', 'feedback', 'data'];
const DEPENDENTS = { controls: ['selection', 'data'], overlays: ['selection', 'data'], layout: ['data'], selection: ['data'] };
const PAGES = {
  'components.tsx': ['controls', 'navigation', 'layout', 'overlays'],   // buttons, inputs, navigation, lists, overlays
  'selection.tsx': ['selection'], 'display.tsx': ['layout', 'navigation'], 'feedback.tsx': ['feedback', 'overlays'],
  'table.tsx': ['data'], 'charts.tsx': ['data'], 'dashboard.tsx': ['data', 'navigation', 'feedback'],
};
const IGNORE = [/\.md$/, /^docs\//, /^LICENSE$/, /^packages\/[^/]+\/LICENSE$/, /^packages\/[^/]+\/test\//, /^\.gitignore$/];

/* react source file -> categories, from the entries; and who imports whom, so a change reaches the components
   built on the changed file (a component that renders another category's component is covered with it) */
const entryOf = {};
for (const c of CATS) for (const m of read(`packages/react/src/entries/${c}.ts`).matchAll(/from '\.\.\/([\w-]+)'/g)) (entryOf[m[1]] ??= new Set()).add(c);
const importers = {};
for (const f of readdirSync(new URL('packages/react/src/', ROOT))) {
  const name = f.replace(/\.tsx?$/, '');
  if (name === f || name === 'index') continue;
  for (const m of read(`packages/react/src/${f}`).matchAll(/from '\.\/([\w-]+)'/g)) (importers[m[1]] ??= new Set()).add(name);
}
const reach = (name) => { const seen = new Set([name]), todo = [name]; while (todo.length) for (const i of importers[todo.pop()] ?? []) if (!seen.has(i)) { seen.add(i); todo.push(i); } return [...seen]; };

/* library component name -> category, from the entries (named exports, or everything a re-exported file exports) */
const catOfName = {};
for (const c of CATS) {
  const src = read(`packages/react/src/entries/${c}.ts`);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*from '\.\.\/([\w-]+)'/g)) for (const n of m[1].split(',')) { const name = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop(); if (name) catOfName[name] ??= c; }
  for (const m of src.matchAll(/export \* from '\.\.\/([\w-]+)'/g)) {
    const file = readdirSync(new URL('packages/react/src/', ROOT)).find((f) => f.replace(/\.tsx?$/, '') === m[1]);
    for (const e of read(`packages/react/src/${file}`).matchAll(/^export (?:function|const|class|type|interface|enum) (\w+)/gm)) catOfName[e[1]] ??= c;
  }
}
/* a docs page's categories: listed in PAGES, or those of the components it imports (null: only foundation -> everything) */
const pageCats = (file) => {
  if (PAGES[file]) return PAGES[file];
  const imp = [...read(`apps/docs/src/pages/${file}`).matchAll(/import\s*\{([^}]*)\}\s*from '@satin-glass\/react[^']*'/g)].flatMap((m) => m[1].split(',').map((n) => n.trim().replace(/^type\s+/, '')));
  const c = [...new Set(imp.map((n) => catOfName[n]).filter((x) => x && x !== 'foundation'))];
  return c.length ? c : null;
};
/* docs.css: the classes on the changed lines (each line's rule selector) -> the files that use them */
const DOCS_DIR = 'apps/docs/src/';
const docsFiles = [...readdirSync(new URL(DOCS_DIR, ROOT)).filter((f) => f.endsWith('.tsx')), ...readdirSync(new URL(`${DOCS_DIR}pages/`, ROOT)).map((f) => `pages/${f}`)];
const docsCssPages = (base) => {
  if (!base || base === '(given)') return null;
  const diff = spawnSync('git', ['diff', '-U0', base, '--', `${DOCS_DIR}docs.css`], { encoding: 'utf8' }).stdout;
  const now = read(`${DOCS_DIR}docs.css`).split('\n');
  const old = spawnSync('git', ['show', `${base}:${DOCS_DIR}docs.css`], { encoding: 'utf8' }).stdout.split('\n');
  const classes = new Map();   /* class -> found on a removed line only (true) */
  for (const h of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    for (const [lines, start, count, gone] of [[old, +h[1], h[2] === undefined ? 1 : +h[2], true], [now, +h[3], h[4] === undefined ? 1 : +h[4], false]]) {
      for (let i = start - 1; i < start - 1 + count; i++) {
        if (/^\s*(\/\*.*\*\/)?\s*$/.test(lines[i] ?? '')) continue;   /* blank or a comment alone */
        let j = i; while (j > 0 && !lines[j].includes('{')) j--;   /* the rule this line belongs to */
        const sel = lines[j].split('{')[0];
        const cs = [...sel.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]);
        if (!cs.length) return null;
        cs.filter((c) => !c.startsWith('sg-')).forEach((c) => classes.set(c, (classes.get(c) ?? true) && gone));
      }
    }
  }
  const pages = new Set();
  for (const [c, removedOnly] of classes) {
    const users = docsFiles.filter((f) => new RegExp(`[\\s"'\`]${c}[\\s"'\`]`).test(read(`${DOCS_DIR}${f}`)));
    if (!users.length && removedOnly) continue;   /* a rule taken out with its last user: nothing shows it now */
    if (!users.length || users.some((f) => !f.startsWith('pages/'))) return null;
    users.forEach((f) => pages.add(f.slice(6)));
  }
  return [...pages];
};

/* --files a,b: pretend these changed (to see what a change would run, with --dry) */
const fi = process.argv.indexOf('--files');
const bi = process.argv.indexOf('--base');
const { base, files } = fi >= 0 ? { base: bi >= 0 ? process.argv[bi + 1] : '(given)', files: process.argv[fi + 1].split(',') } : changedFiles(process.argv.slice(2), process.env.E2E_BASE);
const cats = new Set(), cssCats = new Set(), suites = new Set(), why = [];
let all = false, css = false;
const everything = (f, reason) => { all = true; why.push(`${f}: ${reason} -> everything`); };
for (const f of files) {
  let m;
  if (IGNORE.some((r) => r.test(f))) continue;
  if ((m = f.match(/^packages\/react\/src\/entries\/([\w-]+)\.ts$/)) && CATS.includes(m[1]) && m[1] !== 'foundation') {
    cats.add(m[1]); why.push(`${f}: ${m[1]}`);
  } else if ((m = f.match(/^packages\/react\/src\/([\w-]+)\.tsx?$/))) {
    if (!entryOf[m[1]] || entryOf[m[1]].has('foundation')) everything(f, 'shared by every category');
    else {
      const c = new Set(reach(m[1]).flatMap((n) => [...(entryOf[n] ?? [])]));
      if (c.has('foundation')) everything(f, 'used by foundation');
      else { c.forEach((x) => cats.add(x)); why.push(`${f}: ${[...c].join(', ')}`); }
    }
  } else if ((m = f.match(/^packages\/core\/styles\/([\w-]+)\.css$/))) {
    css = true;
    if (m[1] === 'foundation' || !CATS.includes(m[1])) everything(f, 'stylesheet every category builds on'); else { cats.add(m[1]); cssCats.add(m[1]); why.push(`${f}: ${m[1]}`); }
  } else if ((m = f.match(/^apps\/docs\/src\/pages\/([\w-]+\.tsx)$/)) && pageCats(m[1])) {
    const c = pageCats(m[1]); c.forEach((x) => cats.add(x)); why.push(`${f}: ${c.join(', ')}`);
  } else if (f === `${DOCS_DIR}docs.css` && docsCssPages(base)?.every((pg) => pageCats(pg))) {
    const pg = docsCssPages(base), c = [...new Set(pg.flatMap((x) => pageCats(x)))];
    c.forEach((x) => cats.add(x)); why.push(`${f}: the classes changed are used on ${pg.join(', ') || 'no page'} -> ${c.join(', ') || '(nothing)'}`);
  } else if ((m = f.match(/^tests\/e2e\/([\w-]+\.mjs)$/)) && !['run.mjs', 'changed.mjs', 'pw.mjs', 'pages.mjs'].includes(m[1])) {
    suites.add(m[1]); why.push(`${f}: that suite`);
  } else if (/^packages\/tokens\//.test(f)) { css = true; everything(f, 'design tokens'); }
  else everything(f, /^packages\/core\/src\//.test(f) ? 'core behaviour shared by every category' : /^apps\/docs\//.test(f) ? 'the docs app frame' : 'not mapped to a category');
}
/* a changed stylesheet reaches the categories whose stylesheets build on it */
for (let grew = true; grew;) { grew = false; for (const c of [...cssCats]) for (const d of DEPENDENTS[c] ?? []) if (!cssCats.has(d)) { cssCats.add(d); cats.add(d); grew = true; why.push(`${d}: needs the ${c} stylesheet`); } }

/* suites and what they cover */
const covers = {};
for (const f of readdirSync(new URL('tests/e2e/', ROOT))) {
  const m = f.endsWith('.mjs') && read(`tests/e2e/${f}`).match(/^\/\/ covers: ([^(]+?)\s*(?:\(|$)/m);
  if (m) covers[f] = m[1].split(',').map((s) => s.trim());
}
const full = [], broad = [];
if (!all) {
  for (const [f, c] of Object.entries(covers)) {
    if (suites.has(f) || c.some((x) => cats.has(x))) full.push(f);
    else if ((c.includes('*') && cats.size) || (c.includes('css') && css)) broad.push(f);
  }
  for (const f of suites) if (!full.includes(f)) full.push(f);
}

console.log(`base ${base}: ${files.length} changed file(s)`);
for (const w of why) console.log(`  ${w}`);
if (all) console.log('\n-> the full run');
else if (!full.length && !broad.length) { console.log('\n-> nothing to run'); process.exit(0); }
else {
  console.log(`\n-> categories: ${[...cats].join(', ') || '(none)'}`);
  console.log(`-> all engines: ${full.join(', ') || '(none)'}`);
  console.log(`-> Chromium only: ${broad.join(', ') || '(none)'}`);
}
if (process.argv.includes('--dry')) process.exit(0);
const env = all ? process.env : { ...process.env, E2E_FILES: full.join(','), E2E_BROAD: broad.join(',') };
process.exit(spawnSync('node', ['tests/e2e/run.mjs'], { stdio: 'inherit', env }).status ?? 1);
