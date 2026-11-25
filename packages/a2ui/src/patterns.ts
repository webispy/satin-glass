/* Agent-supplied regular expressions (v0.9.1 `validationRegexp`, and the basic catalog's `regex` function in both
   versions) run synchronously on the page. A browser's regex engine backtracks, so a pattern that is valid can still
   take exponential (or high polynomial) time. web_core's static check lets some of those through, so this package
   accepts only a subset whose work is bounded:
   - no backreferences, no lookaround;
   - a quantified group may not itself hold a quantifier or an alternation (no nested or ambiguous repetition);
   - at most two unbounded quantifiers (`*`, `+`, `{m,}`), and the bounded ones (`?`, `{m,n}`) multiply to at most
     256 ways;
   - the pattern is at most 200 characters, and it is run on text of at most 256 characters (longer text fails).
   At that size the worst case is a few million steps. */
export const MAX_PATTERN = 200;
export const MAX_TEXT = 256;

export function safePattern(source: string): RegExp | null {
  if (typeof source !== 'string' || source.length > MAX_PATTERN) return null;
  if (/\\[1-9]|\\k<|\(\?<?[=!]/.test(source)) return null;
  const groups: { quantified: boolean; alternation: boolean }[] = [];
  let unbounded = 0, product = 1, lastWasGroup: { quantified: boolean; alternation: boolean } | null = null, atom = false;
  const quantify = (min: number, max: number) => {
    if (!atom) return false;
    if (lastWasGroup && (lastWasGroup.quantified || lastWasGroup.alternation)) return false;
    if (max === Infinity) unbounded++;
    else product *= max - min + 1;
    if (groups.length) groups[groups.length - 1].quantified = true;
    atom = false; lastWasGroup = null;
    return unbounded <= 2 && product <= 256;
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '\\') { i++; atom = true; lastWasGroup = null; continue; }
    if (c === '[') {
      /* a character class, to its unescaped closing bracket */
      let j = i + 1;
      if (source[j] === '^') j++;
      if (source[j] === ']') j++;
      for (; j < source.length && source[j] !== ']'; j++) if (source[j] === '\\') j++;
      if (j >= source.length) return null;
      i = j; atom = true; lastWasGroup = null; continue;
    }
    if (c === '(') { if (source[i + 1] === '?') { if (source[i + 2] !== ':') return null; i += 2; } groups.push({ quantified: false, alternation: false }); atom = false; continue; }
    if (c === ')') { const g = groups.pop(); if (!g) return null; if (groups.length && (g.quantified || g.alternation)) { groups[groups.length - 1].quantified ||= g.quantified; groups[groups.length - 1].alternation ||= g.alternation; } lastWasGroup = g; atom = true; continue; }
    if (c === '|') { if (groups.length) groups[groups.length - 1].alternation = true; atom = false; lastWasGroup = null; continue; }
    if (c === '*' || c === '+' || c === '?') {
      if (!quantify(c === '+' ? 1 : 0, c === '?' ? 1 : Infinity)) return null;
      if (source[i + 1] === '?') i++;   // a lazy quantifier
      continue;
    }
    if (c === '{') {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(source.slice(i));
      if (m) {
        const min = Number(m[1]), max = m[2] === undefined ? min : m[3] === '' ? Infinity : Number(m[3]);
        if (max !== Infinity && (max < min || max > 1000)) return null;
        if (!quantify(min, max)) return null;
        i += m[0].length - 1;
        if (source[i + 1] === '?') i++;
        continue;
      }
    }
    if (c === '^' || c === '$') { atom = false; lastWasGroup = null; continue; }
    atom = true; lastWasGroup = null;
  }
  if (groups.length) return null;
  try { return new RegExp(source); } catch { return null; }
}

/** whether `text` matches; text longer than MAX_TEXT does not */
export const matches = (re: RegExp, text: string) => text.length <= MAX_TEXT && re.test(text);
