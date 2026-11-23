// The docs' option tables, from the types: every component and props-like type the React package exports, by category
// entry, with each option's type, whether it is required, its default and its description (the JSDoc on the prop).
// Options the component takes from React's DOM attribute interfaces are not listed one by one: the table names the
// interfaces they come from. Props that are a union (one shape per `variant`, say) list every member's options; an
// option only some members have says which. Descriptions start with a capital and end with a full stop, however the
// JSDoc was written. Writes apps/docs/src/generated/props.json; `--check` fails when that file is stale or a
// documented component has an option without a description.
//   node scripts/docs-props.mjs [--check]
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = `${ROOT}packages/react/src/`;
const OUT = `${ROOT}apps/docs/src/generated/props.json`;
const CATS = ['foundation', 'controls', 'layout', 'navigation', 'selection', 'overlays', 'feedback', 'data'];

const base = ts.parseJsonConfigFileContent(JSON.parse(readFileSync(`${ROOT}tsconfig.base.json`, 'utf8')), ts.sys, ROOT).options;
const program = ts.createProgram(CATS.map((c) => `${SRC}entries/${c}.ts`), { ...base, noEmit: true, types: [] });
const checker = program.getTypeChecker();
const FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope | ts.TypeFormatFlags.WriteArrowStyleSignature;

/* options that mean the same on every component: their description when the prop has none of its own */
const COMMON = {
  className: 'Class names added to the root element.',
  style: 'Inline styles for the root element.',
  children: 'The content.',
  'aria-label': 'The accessible name, when no visible label names it.',
  id: 'The id of the root element (or of the form control, on fields).',
  value: 'The current value (controlled). Use with `onChange`.',
  defaultValue: 'The starting value when uncontrolled.',
  onChange: 'Called with the new value when the user changes it.',
  checked: 'Whether it is checked or on (controlled). Use with `onChange`.',
  defaultChecked: 'Whether it starts checked or on when uncontrolled.',
  disabled: 'Cannot be used, and says so to assistive technology.',
  open: 'Whether it is open (controlled). Use with `onClose`.',
  onClose: 'Called when the user asks to close it (Escape, a tap outside or a close button, depending on the component); set `open` to false to close it.',
  locale: 'The locale for dates, numbers, names and the words it writes (a BCP 47 tag, e.g. "ko-KR"; default: the ThemeProvider\'s `locale`, else "en-US").',
  labels: 'Text the component writes itself (names for assistive technology, button text…), for translation; by default in English, or Korean under a Korean locale.',
  placeholder: 'Shown while empty.',
  helperText: 'A hint under the field, read with it as its description; an `error` message takes its place.',
  error: 'Marks the field invalid (aria-invalid); a message (anything but `true`) is shown under the field in place of `helperText`.',
  placement: 'Where the panel opens against its anchor: a side, optionally with an alignment (e.g. "bottom-start"); it flips to the other side when there is no room.',
};

const doc = (sym) => ts.displayPartsToString(sym.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
/* JSDoc is written as a lower-case phrase, COMMON as sentences: the table shows both as sentences */
const sentence = (t) => (!t ? t : (t[0].toUpperCase() + t.slice(1)).replace(/([^.!?…])$/, '$1.'));
const fromReact = (decl) => /node_modules[\\/](@types[\\/]react|csstype)/.test(decl.getSourceFile().fileName);

/* destructuring defaults in the component's own parameter: `{ size = 'md', columns: allColumns }` */
function defaultsOf(sym) {
  const out = {};
  const decl = sym.valueDeclaration ?? sym.declarations?.[0];
  let fn = null;
  if (decl && ts.isFunctionDeclaration(decl)) fn = decl;
  else if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
    const visit = (n) => { if (fn) return; if (ts.isFunctionExpression(n) || ts.isArrowFunction(n)) { fn = n; return; } ts.forEachChild(n, visit); };
    visit(decl.initializer);
  }
  const p = fn?.parameters[0]?.name;
  if (p && ts.isObjectBindingPattern(p)) for (const el of p.elements) {
    const key = (el.propertyName ?? el.name).getText();
    if (el.initializer) out[key] = el.initializer.getText();
  }
  return out;
}

const typeOf = (p, at, optional) => {
  const t = checker.typeToString(checker.getTypeOfSymbolAtLocation(p, at), at, FLAGS);
  return optional ? t.replace(/ \| undefined$/, '').replace(/^undefined \| /, '') : t;
};
/* the string or boolean values a property takes in one member of a union, or null when it is not such a tag */
function tagsOf(p, at) {
  const t = checker.getTypeOfSymbolAtLocation(p, at), out = [];
  for (const u of t.isUnion() ? t.types : [t]) {
    if (u.flags & ts.TypeFlags.Undefined) continue;
    if (u.isStringLiteral()) out.push(JSON.stringify(u.value));
    else if (u.flags & ts.TypeFlags.BooleanLiteral) out.push(checker.typeToString(u));
    else return null;
  }
  return out.length ? out : null;
}
/* "Only with `variant="text"` or `variant="rect"`.": the members that have an option told apart by a tag every
   member carries (the first tag whose values in those members are not taken by the others) */
function onlyWith(members, has, at) {
  const shared = checker.getPropertiesOfType(members[0]).map((p) => p.name)
    .filter((n) => members.every((m) => m.getProperty(n) && tagsOf(m.getProperty(n), at)));
  for (const n of shared) {
    const inside = new Set(members.filter(has).flatMap((m) => tagsOf(m.getProperty(n), at)));
    const outside = members.filter((m) => !has(m)).flatMap((m) => tagsOf(m.getProperty(n), at));
    if (outside.some((v) => inside.has(v))) continue;
    return `Only with ${[...inside].map((v) => `\`${n}=${v.startsWith('"') ? v : `{${v}}`}\``).join(' or ')}.`;
  }
  return 'Only in some forms of the props.';
}

/* the options of one props type: own ones in full, React's DOM ones by the interface they come from. A union is
   listed whole: the options every member has (as TypeScript merges them), then the ones only some have, each with
   the members' types joined and the members named */
function optionsOf(type, defaults, at, component = true) {
  const props = [], inherits = new Set(), seen = new Set();
  const members = type.isUnion() ? type.types : [type];
  const merged = new Map(checker.getPropertiesOfType(type).map((p) => [p.name, p]));
  for (const p0 of members.flatMap((m) => checker.getPropertiesOfType(m))) {
    if (seen.has(p0.name)) continue;
    seen.add(p0.name);
    const p = merged.get(p0.name) ?? p0;
    const decl = p.valueDeclaration ?? p.declarations?.[0];
    if (!decl) continue;
    if (fromReact(decl)) { const owner = decl.parent?.name?.getText?.(); if (owner) inherits.add(owner); continue; }
    if (component && (p.name === 'key' || p.name === 'ref')) continue;
    let optional = (p.flags & ts.SymbolFlags.Optional) !== 0, t, only = '';
    if (merged.has(p.name)) t = typeOf(p, at, optional);
    else {
      const has = (m) => !!m.getProperty(p.name), own = members.filter(has).map((m) => m.getProperty(p.name));
      optional = true;
      t = [...new Set(own.map((q) => typeOf(q, at, true)))].join(' | ');
      only = onlyWith(members, has, at);
    }
    const own = (merged.has(p.name) ? [p] : members.map((m) => m.getProperty(p.name)).filter(Boolean)).map(doc).find(Boolean) ?? '';
    const common = !own && COMMON[p.name];
    const description = [sentence(own || common || ''), only].filter(Boolean).join(' ');
    props.push({ name: p.name, type: t, required: !optional, default: defaults[p.name] ?? null, description: own || common ? description : '', ...(common ? { common: true } : {}) });
  }
  return { props, inherits: [...inherits].sort() };
}

const out = {}, missing = [];
for (const cat of CATS) {
  const file = program.getSourceFile(`${SRC}entries/${cat}.ts`);
  const mod = checker.getSymbolAtLocation(file);
  for (const exp of checker.getExportsOfModule(mod)) {
    const sym = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
    const name = exp.name;
    if (!/^[A-Z]/.test(name) || out[name]) continue;
    const decl = sym.valueDeclaration ?? sym.declarations?.[0];
    if (!decl) continue;
    if (sym.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Variable)) {
      /* a component: called with one props object that returns JSX */
      const sig = checker.getTypeOfSymbolAtLocation(sym, decl).getCallSignatures()[0];
      const param = sig?.getParameters()[0];
      if (!sig || !param || sig.getParameters().length > 2) continue;
      const ret = checker.typeToString(sig.getReturnType());
      if (!/Element|ReactNode|JSX/.test(ret)) continue;
      const ptype = checker.getTypeOfSymbolAtLocation(param, decl);
      const { props, inherits } = optionsOf(ptype, defaultsOf(sym), decl);
      out[name] = { kind: 'component', category: cat, description: sentence(doc(sym)), props, inherits };
    } else if (sym.flags & ts.SymbolFlags.TypeAlias && /Props$|^Column$|Option$|State$/.test(name)) {
      /* props-like types the options refer to (Column<T>, SegmentOption…), when they are object types */
      const type = checker.getDeclaredTypeOfSymbol(sym);
      if (!(type.flags & ts.TypeFlags.Object) && !type.isIntersection()) continue;
      if (/Props$/.test(name)) continue;   /* a component's props are listed under the component */
      const { props, inherits } = optionsOf(type, {}, decl, false);
      if (props.length) out[name] = { kind: 'type', category: cat, description: sentence(doc(sym)), props, inherits };
    }
  }
}
for (const [n, e] of Object.entries(out)) for (const p of e.props) if (!p.description) missing.push(`${n}.${p.name}`);

const json = JSON.stringify(out, null, 1) + '\n';
if (process.argv.includes('--check')) {
  let old = '';
  try { old = readFileSync(OUT, 'utf8'); } catch { /* none yet */ }
  if (missing.length) { console.error(`options without a description (write JSDoc on the prop):\n  ${missing.join('\n  ')}`); process.exit(1); }
  if (old !== json) { console.error('apps/docs/src/generated/props.json is stale: run node scripts/docs-props.mjs'); process.exit(1); }
  console.log(`props.json up to date (${Object.keys(out).length} entries)`);
} else {
  mkdirSync(new URL('./', `file://${OUT}`), { recursive: true });
  writeFileSync(OUT, json);
  console.log(`wrote ${Object.keys(out).length} entries (${Object.values(out).filter((e) => e.kind === 'component').length} components); options without a description: ${missing.length}`);
}
if (process.argv.includes('--missing')) console.log(missing.join('\n'));
