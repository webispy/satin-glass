/* The basic catalogs' functions, per protocol version, from web_core's own implementations. Three changes:
   - the formatting functions read the session's current locale each time they run, so a language change keeps the
     session (its edits, focus and open controls) instead of making new catalogs;
   - `openUrl` goes through the app's URL policy, and needs a user gesture in v0.9.1 too (its declaration there omits
     the flag that makes web_core refuse it in a passive binding);
   - `regex` runs only a pattern whose work is bounded (patterns.ts), on bounded text; another is a failed check. */
import { A2uiExpressionError, createFunctionImplementation, type FunctionImplementation } from '@a2ui/web_core';
import * as v1 from '@a2ui/web_core/catalogs/basic/v1';
import * as v09 from '@a2ui/web_core/v0_9/basic_catalog';
import { openUrl, type AllowUrl } from './urls';
import { matches, MAX_TEXT, safePattern } from './patterns';

export type Version = '1.0' | '0.9';
type Env = { locale: () => string; allowUrl: () => AllowUrl; refused?: (pattern: string) => void };

const MADE: Record<Version, (locale: string) => FunctionImplementation[]> = {
  '1.0': (locale) => v1.createBasicCatalogFunctions({ locale }),
  '0.9': (locale) => v09.createV09SpecFunctions({ locale }),
};

export function catalogFunctions(version: Version, env: Env): FunctionImplementation[] {
  const byLocale = new Map<string, Map<string, FunctionImplementation>>();
  const at = (locale: string) => {
    let m = byLocale.get(locale);
    if (!m) { m = new Map(MADE[version](locale).map((f) => [f.name, f])); byLocale.set(locale, m); }
    return m;
  };
  const base = MADE[version]('en');
  const api = (version === '1.0' ? v1.OpenUrlApi : v09.OpenUrlApi) as typeof v1.OpenUrlApi;
  const open = createFunctionImplementation({ ...api, requiresUserActivation: true }, (args: { url?: unknown }) => {
    if (!openUrl(args.url, env.allowUrl())) throw new A2uiExpressionError(`The app's URL policy refused ${String(args.url)}`, 'openUrl');
  });
  const regexApi = (version === '1.0' ? v1.RegexApi : v09.RegexApi) as typeof v1.RegexApi;
  const regex = createFunctionImplementation(regexApi, (args: { value?: unknown; pattern?: unknown }) => {
    const re = safePattern(String(args.pattern ?? ''));
    if (!re) env.refused?.(String(args.pattern));
    const text = String(args.value ?? '');
    const ok = !!re && matches(re, text);
    if (version === '0.9') return ok as never;
    return (ok ? { valid: true } : { valid: false, message: !re ? 'The pattern is not one this renderer runs.' : text.length > MAX_TEXT ? 'Value exceeds the maximum length for pattern matching.' : 'Value does not match required pattern.' }) as never;
  });
  return base.map((f) => (f.name === 'openUrl' ? open : f.name === 'regex' ? regex : {
    ...f,
    execute: (args: Record<string, unknown>, context: Parameters<FunctionImplementation['execute']>[1], signal?: AbortSignal) =>
      at(env.locale()).get(f.name)!.execute(args, context, signal),
  }));
}
