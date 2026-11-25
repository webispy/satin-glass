/* useA2ui: one A2UI session (a web_core MessageProcessor with the Satin catalogs) that a component owns.
   The session object and its methods keep their identity across renders and read the options of the last committed
   render, so a transport subscribed to `process` once stays subscribed. Its surfaces are a snapshot that components
   subscribe to, so a memoised consumer of the session still sees them change. */
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { MessageProcessor, type A2uiErrorPayload, type A2uiWarningPayload, type OutboundMessageListener, type SurfaceModel } from '@a2ui/web_core';
import { useLocale } from '@satin-glass/react';
import { BASIC_CATALOG_IDS, satinCatalogs } from './catalogs';
import { defaultAllowUrl, type AllowUrl } from './urls';
import { wordsFor, type A2uiWords } from './words';
import type { Diagnostic, Env } from './components/shared';
import type { Version } from './functions';

/** a message the renderer sends to the agent, as A2UI's wire format has it (an action, an error, a function call or
    its result), versioned; hand it to the transport */
export type OutboundEnvelope = Parameters<OutboundMessageListener>[0];
/** a local report: the processor's (a payload that failed validation, a binding to missing data) or this package's
    (a label that would hide the visible text, a missing icon, a refused URL or pattern, a refused message) */
export type A2uiReport = { kind: 'error'; error: A2uiErrorPayload } | { kind: 'warning'; warning: A2uiWarningPayload }
  | ({ kind: 'diagnostic' } & Diagnostic) | { kind: 'input'; message: string };

export type A2uiOptions = {
  /** each message for the agent, versioned. Left out, they are dropped (and reported once). */
  onOutbound?: (envelope: OutboundEnvelope) => void;
  /** local reports. Left out, they go to `console.warn`, once each. */
  onReport?: (report: A2uiReport) => void;
  /** the language for formatting and for the built-in words; default the nearest ThemeProvider's */
  locale?: string;
  /** overrides for any of the built-in words */
  words?: Partial<A2uiWords>;
  /** what to draw for each A2UI icon name (`accountCircle`, `send` …); a name left out draws a neutral glyph */
  icons?: Record<string, React.ReactNode>;
  /** return false to refuse a URL an agent asked for (see `defaultAllowUrl`) */
  allowUrl?: AllowUrl;
  /** the protocol versions to accept and advertise; default ['1.0', '0.9'] (v0.9 is v0.9.1's wire name) */
  versions?: Version[];
};

export type A2uiSession = {
  /** feed messages that arrived from the agent, each once and in order: one envelope, an array, or JSONL text
      (complete lines; a line that does not parse is reported and skipped). Each envelope is checked, copied and
      processed on its own, so one the agent got wrong is reported and the others still apply. Nothing is thrown. */
  process: (input: unknown) => void;
  /** the surfaces, in the order they were created (components subscribe with `subscribe`) */
  readonly surfaces: SurfaceModel[];
  /** what to tell the agent the renderer supports: per protocol version, that version's catalog */
  capabilities: () => Record<string, { supportedCatalogIds: string[] }>;
  /** the data model of the surfaces that asked for it (`sendDataModel`), for the given protocol version */
  dataModel: (version: Version) => unknown;
  /** forget every surface and start a new session; the old one sends nothing more. Does nothing once the component
      that owns the session has unmounted. */
  reset: () => void;
  /** the web_core processor of the moment, for what this API does not cover */
  readonly processor: MessageProcessor;
  /** subscribe to changes of the surfaces; returns the unsubscribe function */
  subscribe: (listener: () => void) => () => void;
  /** the current surfaces */
  getSnapshot: () => SurfaceModel[];
  /** @internal what the components read: the environment of the last committed render */
  readonly env: Env;
};

const WIRE: Record<Version, string> = { '1.0': '1.0', '0.9': 'v0.9' };
/* the wire names each enabled version accepts, and the message kinds each version has */
const ACCEPTS: Record<Version, string[]> = { '1.0': ['1.0'], '0.9': ['v0.9', 'v0.9.1', '0.9', '0.9.1'] };
const KINDS: Record<Version, string[]> = {
  '1.0': ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'callRendererFunction', 'agentFunctionResponse'],
  '0.9': ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'],
};
const versionOf = (wire: string): Version | undefined => (Object.keys(ACCEPTS) as Version[]).find((v) => ACCEPTS[v].includes(wire));

/* reports without an onReport go to the console once each per session; the memory of what was said is bounded */
const teller = () => {
  const told = new Set<string>();
  return (key: string, text: string) => {
    if (told.has(key)) return;
    if (told.size > 500) told.clear();
    told.add(key); console.warn('[@satin-glass/a2ui]', text);
  };
};
const textOf = (r: A2uiReport) => (r.kind === 'error' ? `${r.error.code}: ${r.error.message}` : r.kind === 'warning' ? `${r.warning.code}: ${r.warning.message}` : r.message);

type Live = { proc: MessageProcessor; retired: boolean; stop: () => void };
type Committed = { options: A2uiOptions; locale: string; versions: Version[] };

export function useA2ui(options: A2uiOptions = {}): A2uiSession {
  const themeLocale = useLocale();
  const locale = options.locale ?? themeLocale;
  const versions = options.versions ?? ['1.0', '0.9'];
  /* the same versions in another order are the same session */
  const vkey = [...new Set(versions)].sort().join();
  /* what the last committed render asked for: a render that is never committed changes nothing */
  const committed = useRef<Committed>({ options, locale, versions });
  useLayoutEffect(() => { committed.current = { options, locale, versions }; });

  const api = useMemo(() => {
    const once = teller();
    const report = (r: A2uiReport) => {
      const own = committed.current.options.onReport;
      if (own) own(r); else once(`${r.kind}:${r.kind === 'diagnostic' ? r.componentId : ''}:${textOf(r)}`, textOf(r));
    };
    const state = {} as { live: Live; versions: string; open: boolean; ended: boolean; pending?: ReturnType<typeof setTimeout>; snapshot: SurfaceModel[]; icons: Set<string>; env?: Env };
    const listeners = new Set<() => void>();
    const publish = (list: SurfaceModel[]) => { state.snapshot = list; listeners.forEach((l) => l()); };
    /* the environment of the last committed render; the components read it through the store */
    const publishEnv = (env: Env) => { if (state.env === env) return; state.env = env; listeners.forEach((l) => l()); };
    /* each processor is watched from the moment it is made, so messages processed before any effect still report */
    const make = (): Live => {
      const live: Live = { proc: undefined as never, retired: false, stop: () => {} };
      const proc = new MessageProcessor(
        satinCatalogs({
          versions: committed.current.versions, locale: () => committed.current.locale,
          allowUrl: () => committed.current.options.allowUrl ?? defaultAllowUrl,
          onRefusedPattern: (pattern) => report({ kind: 'diagnostic', code: 'refused-pattern', componentId: '', message: `A regex check was not run: its work is not bounded (${pattern.slice(0, 80)}).` }),
        }),
        undefined,
        {
          unifiedOutbound: true,
          /* a retired processor, or a session whose component has unmounted, sends nothing */
          outboundListener: (m) => {
            if (live.retired || state.ended || (!state.open && state.pending !== undefined)) return;
            const send = committed.current.options.onOutbound;
            if (send) send(m); else once('no-outbound', 'A message for the agent was dropped: pass onOutbound to useA2ui.');
          },
          /* a payload the agent got wrong is reported (and sent back to it as an error message), never thrown */
          reportErrorsOnly: true,
        },
      );
      live.proc = proc;
      const watched = new Map<string, { unsubscribe: () => void }[]>();
      const sync = () => { if (!live.retired && state.live === live) publish([...proc.model.surfacesMap.values()] as SurfaceModel[]); };
      const watch = (s: SurfaceModel) => {
        if (watched.has(s.id)) return;
        watched.set(s.id, [
          s.onError.subscribe((error) => { if (!live.retired) report({ kind: 'error', error }); }),
          s.onWarning.subscribe((warning) => { if (!live.retired) report({ kind: 'warning', warning }); }),
        ]);
      };
      const subs = [
        proc.onSurfaceCreated((s) => { watch(s as SurfaceModel); sync(); }),
        proc.onSurfaceDeleted((id) => { watched.get(id)?.forEach((x) => x.unsubscribe()); watched.delete(id); sync(); }),
        /* errors without a surface (an update for one that does not exist) come from the group */
        proc.model.onError.subscribe((error) => { if (!live.retired && (!error.surfaceId || !watched.has(error.surfaceId))) report({ kind: 'error', error }); }),
      ];
      live.stop = () => { subs.forEach((s) => s.unsubscribe()); watched.forEach((l) => l.forEach((x) => x.unsubscribe())); };
      return live;
    };
    const retire = (live: Live) => { if (live.retired) return; live.retired = true; live.stop(); live.proc.dispose(); };
    const swap = () => { const old = state.live; state.live = make(); state.versions = [...new Set(committed.current.versions)].sort().join(); retire(old); publish([]); };
    state.live = make(); state.versions = [...new Set(committed.current.versions)].sort().join();
    state.open = false; state.ended = false; state.snapshot = []; state.icons = new Set();

    /* one wire envelope: an object with the version and exactly one message of that version's kinds */
    const check = (m: unknown): string | undefined => {
      if (!m || typeof m !== 'object' || Array.isArray(m)) return 'A message that is not an object was refused.';
      const { version, ...rest } = m as Record<string, unknown>;
      const accepted = committed.current.versions.flatMap((v) => ACCEPTS[v]);
      if (typeof version !== 'string' || !accepted.includes(version)) {
        return `A message of protocol version ${version === undefined ? '0.8 (no version)' : String(version)} was refused: this session accepts ${accepted.join(', ')}.`;
      }
      const keys = Object.keys(rest), v = versionOf(version)!;
      if (keys.length !== 1 || !KINDS[v].includes(keys[0])) return `A message with ${keys.join(', ') || 'nothing'} was refused: a ${version} message has exactly one of ${KINDS[v].join(', ')}.`;
      return undefined;
    };
    const process = (input: unknown) => {
      if (state.ended || !state.open && state.pending !== undefined) { report({ kind: 'input', message: 'A message arrived after the session ended; it was dropped.' }); return; }
      let list: unknown[];
      if (typeof input === 'string') {
        list = [];
        input.split(/\r?\n/).forEach((line, i) => {
          if (!line.trim()) return;
          try { list.push(JSON.parse(line)); } catch { report({ kind: 'input', message: `Line ${i + 1} of the JSONL input is not JSON; it was skipped.` }); }
        });
      } else list = Array.isArray(input) ? input : [input];
      const live = state.live;
      for (const m of list) {
        /* a reset while this batch runs (from a report callback, say) ends it: the rest was meant for the old session */
        if (state.live !== live || live.retired) return;
        const why = check(m);
        if (why) { report({ kind: 'input', message: why }); continue; }
        let copy: unknown;
        try { copy = structuredClone(m); } catch { report({ kind: 'input', message: 'A message that cannot be copied (it holds a function or similar) was refused.' }); continue; }
        /* one at a time: web_core prepares a whole batch before applying any of it */
        live.proc.processMessages(copy as never);
      }
    };
    const session: A2uiSession = {
      process,
      get surfaces() { return state.snapshot; },
      /* web_core 0.16.1 lists every registered catalog under every version; each version gets its own here */
      capabilities: () => Object.fromEntries(committed.current.versions.map((v) => [WIRE[v], { supportedCatalogIds: [BASIC_CATALOG_IDS[v]] }])),
      dataModel: (version) => (state.live.retired ? undefined : state.live.proc.getClientDataModel(WIRE[version])),
      reset: () => { if (state.ended) { report({ kind: 'input', message: 'reset() was called after the session ended; nothing was done.' }); return; } swap(); },
      get processor() { return state.live.proc; },
      subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
      getSnapshot: () => state.snapshot,
      get env() { return state.env!; },
    };
    return { state, swap, retire, report, session, publishEnv };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  /* a different set of versions is a different session, changed once that render is committed */
  useEffect(() => { if (api.state.versions !== vkey && !api.state.ended) api.swap(); }, [vkey, api]);

  /* mounted: the session is open. Unmounted: it closes at once (nothing in, nothing out) and its processor is let go a
     tick later, so StrictMode's trial unmount, followed by a remount in the same tick, keeps its surfaces */
  useEffect(() => {
    clearTimeout(api.state.pending); api.state.pending = undefined;
    api.state.open = true;
    return () => {
      api.state.open = false;
      api.state.pending = setTimeout(() => { api.state.pending = undefined; if (!api.state.open) { api.state.ended = true; api.retire(api.state.live); } }, 0);
    };
  }, [api]);

  /* re-render the owner when the surfaces change */
  useSyncExternalStore(api.session.subscribe, api.session.getSnapshot, api.session.getSnapshot);
  const words = useMemo(() => wordsFor(locale, options.words), [locale, options.words]);
  const icons = options.icons;
  const allowUrl = options.allowUrl;
  const env = useMemo<Env>(() => ({
    words, icons: icons ?? {}, allowUrl: allowUrl ?? defaultAllowUrl,
    warn: (d) => {
      /* a missing icon is reported once per name for the whole session */
      if (d.code === 'missing-icon') { if (api.state.icons.has(d.message)) return; api.state.icons.add(d.message); }
      api.report({ kind: 'diagnostic', ...d });
    },
  }), [words, icons, allowUrl, api]);
  /* the first render's environment is the session's until a render commits; a render that never commits (an abandoned
     transition) leaves the committed one in place */
  if (!api.state.env) api.state.env = env;
  useLayoutEffect(() => { api.publishEnv(env); }, [api, env]);
  return api.session;
}
