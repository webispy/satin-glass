/// <reference types="node" />
/* The public API, held to a reviewed list: every name (value or type) the root and each category entry point export,
   as TypeScript resolves them through `export *`. An internal helper that a module exports for its siblings would
   otherwise leak through `export *` and become API (useBridge, glassClass and cx did, in 0.5). To change the list on
   purpose, run with UPDATE_EXPORTS=1 (exactly 1), and say what changed in the CHANGELOG (and the README's tables). */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/* paths from node:path: this file runs in jsdom, whose URL is not node's */
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '../src/');
const LIST = join(HERE, 'exports.json');
const entries: Record<string, string> = { '.': `${SRC}index.ts` };
for (const f of readdirSync(`${SRC}entries`).filter((f) => f.endsWith('.ts'))) entries[`./${f.replace(/\.ts$/, '')}`] = `${SRC}entries/${f}`;

/* names TypeScript sees: values and types; a type-only export is written `type Name` */
function exportsOf(): Record<string, string[]> {
  const program = ts.createProgram(Object.values(entries), { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, skipLibCheck: true, noEmit: true });
  const checker = program.getTypeChecker();
  const out: Record<string, string[]> = {};
  for (const [path, file] of Object.entries(entries)) {
    const sym = checker.getSymbolAtLocation(program.getSourceFile(file)!)!;
    out[path] = checker.getExportsOfModule(sym).map((s) => s.getName()).sort();
  }
  return out;
}
/* names that exist at run time: a value re-exported with `export type` would keep its name above but vanish here */
async function valuesOf(): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [path, file] of Object.entries(entries)) out[path] = Object.keys(await import(/* @vite-ignore */ file)).sort();
  return out;
}

describe('public exports', () => {
  it('match the reviewed list (exports.json): every name, and which of them are values', async () => {
    const names = exportsOf(), values = await valuesOf();
    const now = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, { values: values[k], types: v.filter((n) => !values[k].includes(n)) }]));
    if (process.env.UPDATE_EXPORTS === '1') writeFileSync(LIST, `${JSON.stringify(now, null, 1)}\n`);
    expect(now).toEqual(JSON.parse(readFileSync(LIST, 'utf8')));
  }, 60_000);
  it('package.json publishes exactly these entry points, from their own built files', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '../package.json'), 'utf8')) as { exports: Record<string, { types: string; import: string }> };
    const js = Object.keys(pkg.exports).filter((k) => typeof pkg.exports[k] === 'object' && 'import' in pkg.exports[k]).sort();
    expect(js).toEqual(Object.keys(entries).sort());
    for (const k of js) {
      const base = k === '.' ? 'index' : k.slice(2);
      expect(pkg.exports[k]).toMatchObject({ types: `./dist/${base}.d.ts`, import: `./dist/${base}.js` });
    }
  });
  it('leave out the internal helpers', () => {
    const all = Object.values(exportsOf()).flat();
    for (const name of ['useBridge', 'glassClass', 'cx', 'mergeRefs', 'useStableId', 'useIsoLayoutEffect']) expect(all).not.toContain(name);
  }, 60_000);
});
