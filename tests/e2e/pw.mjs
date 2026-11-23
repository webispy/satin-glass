// Playwright with the docs' language decided once: every page and context opens in Korean (the language the suites
// read their labels in) unless E2E_LANG=en. The docs pick their language from ?lang=, then a saved choice, then the
// browser's; a fresh Playwright context has no saved choice, so its locale decides. Suites import this instead of
// 'playwright'; anything not overridden here is Playwright's own.
import * as playwright from 'playwright';
export * from 'playwright';

export const LANG = process.env.E2E_LANG === 'en' ? 'en' : 'ko';
const LOCALE = LANG === 'en' ? 'en-US' : 'ko-KR';

const withLocale = (type) => new Proxy(type, {
  get(t, k) {
    if (k === 'launch') return async (opts) => {
      const b = await t.launch(opts);
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
