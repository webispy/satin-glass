/* The docs' two languages. Strings stay next to the demo they explain, as { en, ko } pairs (t()) or <L en ko>, so a
   page reads in one place and nothing hides in a catalogue. The language comes from ?lang=, then the reader's saved
   choice, then the browser's first language (Korean when it is ko / ko-*), else English. Switching keeps the path,
   the other query settings and the hash, saves the choice and sets <html lang>. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ko';
export type Pair<T = string> = { en: T; ko: T };
const KEY = 'sg-docs-lang';

const valid = (v: string | null | undefined): v is Lang => v === 'en' || v === 'ko';
const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function resolveLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (valid(q)) return q;
  const s = stored();
  if (valid(s)) return s;
  const first = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  return first === 'ko' || first.startsWith('ko-') ? 'ko' : 'en';
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>(resolveLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo<Ctx>(() => ({
    lang,
    setLang: (l) => {
      set(l);
      try { localStorage.setItem(KEY, l); } catch { /* private mode: the URL still carries it */ }
      const u = new URL(location.href);
      u.searchParams.set('lang', l);
      history.replaceState(history.state, '', u);
    },
  }), [lang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx).lang;
export const useSetLang = () => useContext(LangCtx).setLang;

/** Pick the current language's side of a pair: `t({ en: 'Save', ko: '저장' })`. */
export function useT() {
  const lang = useLang();
  return <T,>(p: Pair<T>): T => p[lang];
}

/** Prose in JSX: `<L en={<>…</>} ko={<>…</>} />`. */
export function L({ en, ko }: Pair<ReactNode>) {
  return <>{useLang() === 'en' ? en : ko}</>;
}

/** The Intl locale for numbers, dates and the components' `locale` props. */
export const intlLocale = (lang: Lang) => (lang === 'ko' ? 'ko-KR' : 'en-US');
export const useLocale = () => intlLocale(useLang());
