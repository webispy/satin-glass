// Playwright with the docs' language decided once: every page and context opens in Korean (the language the suites
// read their labels in) unless E2E_LANG=en. The docs pick their language from ?lang=, then a saved choice, then the
// browser's; a fresh Playwright context has no saved choice, so its locale decides. Suites import this instead of
// 'playwright'; anything not overridden here is Playwright's own.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as playwright from 'playwright';
export * from 'playwright';

export const LANG = process.env.E2E_LANG === 'en' ? 'en' : 'ko';
const LOCALE = LANG === 'en' ? 'en-US' : 'ko-KR';

// macOS 27 guards ~/Library/Application Support/Firefox, and Gecko reads that folder even when given a profile of its
// own, so Firefox exits with "Could not find profile folder." unless the terminal has Full Disk Access
// (microsoft/playwright#42768). MOZ_APP_DATA moves only that folder, here to an empty one every launch shares;
// profiles stay Playwright's own, one per launch. On any macOS: which Darwin a macOS 27 reports is not settled (27 on
// the machine this was found on, 26 by the numbering since macOS 26), and the empty folder harms no other version.
// A MOZ_APP_DATA already set, even empty, is left alone.
const withAppData = (type, opts = {}) => {
  const env = opts.env ?? process.env;
  if (type.name() !== 'firefox' || process.platform !== 'darwin' || env.MOZ_APP_DATA !== undefined) return opts;
  const dir = join(tmpdir(), 'satin-glass-e2e-firefox');
  mkdirSync(dir, { recursive: true });
  return { ...opts, env: { ...env, MOZ_APP_DATA: dir } };
};

const withLocale = (type) => new Proxy(type, {
  get(t, k) {
    if (k === 'launch') return async (opts) => {
      const b = await t.launch(withAppData(t, opts));
      const page = b.newPage.bind(b), context = b.newContext.bind(b);
      b.newPage = (o = {}) => page({ locale: LOCALE, ...o });
      b.newContext = (o = {}) => context({ locale: LOCALE, ...o });
      return b;
    };
    const v = t[k];
    return typeof v === 'function' ? v.bind(t) : v;
  },
});
export const chromium = withLocale(playwright.chromium);
export const webkit = withLocale(playwright.webkit);
export const firefox = withLocale(playwright.firefox);
