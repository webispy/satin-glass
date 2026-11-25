// Every docs page, by its hash, read from the docs' route manifest (apps/docs/src/routes.ts) so that a new page is
// checked by every suite that walks all pages. Guarded: a list that cannot be read must not pass by checking nothing.
import { readFileSync } from 'node:fs';

export const PAGES = [...readFileSync(new URL('../../apps/docs/src/routes.ts', import.meta.url), 'utf8').matchAll(/\{ id: '([a-z0-9-]+)', label:/g)].map((m) => m[1]);
if (PAGES.length < 15) throw new Error(`found only ${PAGES.length} docs pages in apps/docs/src/routes.ts`);
