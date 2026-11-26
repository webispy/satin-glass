/* A2UI's own basic catalog examples (the same files the package's conformance tests replay, from a2ui-project/a2ui,
   Apache-2.0; see packages/a2ui/test/fixtures/README.md), drawn by @satin-glass/a2ui. Their text is the A2UI
   project's, in English. Media they link to is on other sites, so it is loaded only when asked for: the switch is
   the app's URL policy (`allowUrl`).
   Every example is drawn live in a grid; one opens in a wide sheet beside the JSON it was drawn from. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { A2uiSurfaces, useA2ui, type A2uiReport, type A2uiSession, type AllowUrl, type OutboundEnvelope } from '@satin-glass/a2ui';
import { Button, Card, IconButton, SearchField, SegmentedControl, Sheet, Switch, Tabs, Text, useToast } from '@satin-glass/react';
import { Bot, ChevronLeft, ChevronRight, Copy, Image as ImageIcon, MousePointerClick, X } from 'lucide-react';
import { useT } from '../i18n';
import { A2UI_ICONS } from './icons';

type Message = Record<string, unknown>;
type Fixture = { name: string; description?: string; messages: Message[] };
const FILES = import.meta.glob<Fixture>('../../../../packages/a2ui/test/fixtures/*/*.json', { import: 'default', eager: true });
const DIRS = { '1.0': 'v1', '0.9': 'v0_9_1' } as const;
type V = keyof typeof DIRS;
/** `kinds`: every component the example uses, which search reads; `shown`: those named on its card, without the ones
    nearly every example has */
type Example = { slug: string; name: string; fixture: Fixture; kinds: string[]; shown: string[] };

const COMMON = ['Row', 'Column', 'Card', 'Text', 'Divider'];
const componentsOf = (f: Fixture) => {
  const seen = new Set<string>();
  for (const m of f.messages) {
    const list = (m.updateComponents as { components?: { component?: string }[] } | undefined)?.components ?? [];
    for (const c of list) if (c.component) seen.add(c.component);
  }
  return [...seen].sort();
};
const EXAMPLES: Record<V, Example[]> = Object.fromEntries((Object.keys(DIRS) as V[]).map((v) => [v,
  Object.entries(FILES).filter(([k]) => k.includes(`/fixtures/${DIRS[v]}/`))
    .map(([k, fixture]) => { const kinds = componentsOf(fixture); return { slug: k.split('/').pop()!.replace(/\.json$/, ''), name: fixture.name, fixture, kinds, shown: kinds.filter((c) => !COMMON.includes(c)) }; })
    .sort((a, b) => a.name.localeCompare(b.name, 'en')),
])) as Record<V, Example[]>;
const matches = (e: Example, q: string) => { const s = q.trim().toLowerCase(); return !s || e.name.toLowerCase().includes(s) || e.kinds.some((k) => k.toLowerCase().includes(s)); };

const sameOrigin: AllowUrl = (u) => u.origin === location.origin;

/** one live example: its own session, replayed when it mounts and again from the start up to `step` messages (the
    step-by-step view). The examples are written in English, so their dates, numbers and check messages are English
    too; the name of the region around them is the page's (it is the page speaking, not the agent). */
function useExample(example: Example, media: boolean, step = example.fixture.messages.length) {
  const t = useT();
  const [sent, setSent] = useState<OutboundEnvelope[]>([]);
  /* refused media, one per component: the surfaces are drawn again when the switch moves, and say so again */
  const [refusedBy, setRefusedBy] = useState<ReadonlySet<string>>(new Set());
  const onReport = (r: A2uiReport) => {
    if (r.kind === 'diagnostic' && r.code === 'refused-url') setRefusedBy((had) => had.has(r.componentId ?? '') ? had : new Set(had).add(r.componentId ?? ''));
  };
  const surface = t({ en: 'Agent content', ko: '에이전트 콘텐츠' });
  const words = useMemo(() => ({ surface }), [surface]);
  /* the URL policy reaches surfaces already drawn: media refused with the switch off appear when it is turned on, and
     the surface keeps its state (a chosen tab) */
  const a2ui = useA2ui({ onOutbound: (m) => setSent((l) => [...l, m]), onReport, icons: A2UI_ICONS, locale: 'en', words, allowUrl: media ? undefined : sameOrigin });
  useEffect(() => {
    setSent([]); setRefusedBy(new Set());
    a2ui.reset();
    a2ui.process(example.fixture.messages.slice(0, step));
  }, [example, a2ui, step]);
  return { a2ui, sent, refused: refusedBy.size };
}

/** whether images, video and sound load from the sites an example names; in the toolbar, and in the sheet so an open
    example can be seen both ways */
function MediaSwitch({ media, setMedia }: { media: boolean; setMedia: (on: boolean) => void }) {
  const t = useT();
  return (
    <label className="a2ui-toolbar__switch">
      <ImageIcon size={18} aria-hidden className="a2ui-toolbar__media-icon" />
      <Text variant="subhead">{t({ en: 'Media from other sites', ko: '다른 사이트의 미디어' })}</Text>
      <Switch size="sm" checked={media} onChange={setMedia} aria-label={t({ en: 'Load media from other sites', ko: '다른 사이트의 미디어 불러오기' })} />
    </label>
  );
}

/** an example's surfaces: the region is named in the page's language, what the agent drew is marked as English.
    A2uiSurfaces puts its `lang` on the region itself, so the name would be read in English too: the language is set
    here on each surface inside the region instead, as the agent creates them */
function Surfaces({ a2ui, className }: { a2ui: A2uiSession; className: string }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = box.current?.firstElementChild;
    if (!region) return;
    const mark = () => region.querySelectorAll(':scope > [data-a2ui-surface]:not([lang])').forEach((s) => s.setAttribute('lang', 'en'));
    mark();
    const watch = new MutationObserver(mark);
    watch.observe(region, { childList: true });
    return () => watch.disconnect();
  }, []);
  return <div ref={box} style={{ display: 'contents' }}><A2uiSurfaces a2ui={a2ui} className={className} /></div>;
}

/* ── the toolbar: finding on the left, the settings for every example on the right ── */

function Toolbar({ q, setQ, version, setVersion, media, setMedia, count }: {
  q: string; setQ: (q: string) => void; version: V; setVersion: (v: V) => void; media: boolean; setMedia: (on: boolean) => void; count: { shown: number; all: number };
}) {
  const t = useT();
  return (
    <div className="a2ui-toolbar">
      <div className="a2ui-toolbar__find">
        <SearchField aria-label={t({ en: 'Find an example: name or component', ko: '예제 찾기: 이름이나 컴포넌트' })} placeholder={t({ en: 'Name or component', ko: '이름이나 컴포넌트' })}
          value={q} onChange={(e) => setQ(e.target.value)} clearable onClear={() => setQ('')} fieldClassName="a2ui-toolbar__search" />
        <Text variant="footnote" tone="secondary" aria-live="polite" tabular>{t({ en: `${count.shown} of ${count.all}`, ko: `${count.all}개 중 ${count.shown}개` })}</Text>
      </div>
      <div className="a2ui-toolbar__settings">
        <MediaSwitch media={media} setMedia={setMedia} />
        <SegmentedControl size="sm" aria-label={t({ en: 'Protocol version', ko: '프로토콜 버전' })} value={version} onChange={(v) => setVersion(v as V)}
          options={[{ value: '1.0', label: 'v1.0' }, { value: '0.9', label: 'v0.9.1' }]} />
      </div>
    </div>
  );
}

/* ── JSON, as it is, in a tall panel that reads like code ── */

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
function Json({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  const out: ReactNode[] = [];
  let at = 0, i = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > at) out.push(text.slice(at, m.index));
    const cls = m[1] ? (m[2] ? 'k' : 's') : m[3] ? 'b' : 'n';
    out.push(<span key={i++} className={`a2ui-json__${cls}`}>{m[1] ?? m[0]}</span>);
    if (m[2]) out.push(m[2]);
    at = m.index! + m[0].length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}
const kindOf = (m: Message) => Object.keys(m).find((k) => k !== 'version') ?? '?';

/** a list of messages, each under a quiet heading with its number and kind, in one scrolling panel */
function Stream({ messages, empty, label, about, step, onStep }: {
  messages: Message[]; empty: string; label: string; about: string;
  /** for the agent's messages: how many are applied, and a heading's press applies up to it */
  step?: number; onStep?: (n: number) => void;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  /* a new message the hand caused is scrolled to; the first ones are read from the top */
  const had = useRef(messages.length);
  useLayoutEffect(() => {
    const b = box.current;
    if (b && messages.length > had.current) b.scrollTop = b.scrollHeight;
    had.current = messages.length;
  }, [messages.length]);
  /* a step chosen with the arrows brings its message into view, under the sticky headings; on opening, the JSON is
     read from its top */
  const shownStep = useRef(step);
  useLayoutEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const b = box.current, block = step ? b?.querySelectorAll<HTMLElement>('.a2ui-code__block')[step - 1] : undefined;
    if (b && block && (block.offsetTop < b.scrollTop || block.offsetTop > b.scrollTop + b.clientHeight - 60)) b.scrollTop = block.offsetTop;
  }, [step]);
  const toast = useToast();
  const copy = () => {
    const failed = () => toast({ title: t({ en: 'Could not copy', ko: '복사하지 못했어요' }), tone: 'danger' });
    if (!navigator.clipboard) { failed(); return; }
    navigator.clipboard.writeText(JSON.stringify(messages, null, 2)).then(() => toast({ title: t({ en: 'Copied', ko: '복사했어요' }) }), failed);
  };
  return (
    <div className="a2ui-code">
      <Text variant="footnote" tone="secondary" className="a2ui-code__about">{about}</Text>
      <div className="a2ui-code__box">
        {messages.length > 0 && <IconButton className="a2ui-code__copy" size="sm" variant="plain" icon={<Copy size={16} />} label={t({ en: 'Copy JSON', ko: 'JSON 복사' })} onClick={copy} />}
        <div ref={box} className="a2ui-code__scroll" tabIndex={0} role="region" aria-label={label}>
          {messages.length === 0
            ? <Text variant="footnote" tone="secondary" className="a2ui-code__empty">{empty}</Text>
            : messages.map((m, i) => {
              const state = step === undefined ? undefined : i + 1 === step ? 'current' : i + 1 > step ? 'later' : 'done';
              const head = <>{i + 1} · {kindOf(m)}{state === 'later' && <span className="a2ui-code__later">{t({ en: 'not applied yet', ko: '적용 전' })}</span>}</>;
              return (
                <section key={i} className="a2ui-code__block" data-state={state}>
                  {onStep
                    ? <button type="button" className="a2ui-code__head" aria-current={state === 'current' ? 'step' : undefined} onClick={() => onStep(i + 1)}
                      title={t({ en: 'Show the screen up to this message', ko: '이 메시지까지 적용한 화면 보기' })}>{head}</button>
                    : <div className="a2ui-code__head">{head}</div>}
                  <pre className="a2ui-json" lang="en"><Json value={m} /></pre>
                </section>
              );
            })}
        </div>
      </div>
    </div>
  );
}

/** an example, live, beside the JSON it was drawn from and the JSON it sent back */
function Inspector({ example, media }: { example: Example; media: boolean }) {
  const t = useT();
  const n = example.fixture.messages.length;
  const [step, setStep] = useState(n);
  const { a2ui, sent, refused } = useExample(example, media, step);
  const [tab, setTab] = useState<'in' | 'out'>('in');
  /* an action the hand just sent is what it wants to see */
  const seen = useRef(0);
  useEffect(() => { if (sent.length > seen.current) setTab('out'); seen.current = sent.length; }, [sent.length]);
  /* the direction is the name (agent → screen, screen → agent); the line under the tabs says what the JSON is */
  const inLabel = t({ en: 'Agent → screen', ko: '에이전트 → 화면' }), outLabel = t({ en: 'Screen → agent', ko: '화면 → 에이전트' });
  const aboutIn = t({ en: `The ${n} A2UI messages the agent sent to draw this screen.`, ko: `에이전트가 이 화면을 그리려고 보낸 A2UI 메시지 ${n}개입니다.` });
  const aboutOut = t({ en: 'What the screen sends back when a button is pressed: the action and any values it carries.', ko: '화면에서 버튼을 누르면 에이전트로 돌려보내는 메시지입니다. 액션과 함께 전달하는 값이 들어 있습니다.' });
  /* more than half the examples have no button: say so rather than ask for a press that cannot happen */
  const emptyOut = example.kinds.includes('Button')
    ? t({ en: 'Nothing yet. Press a button on the screen and what it sends appears here.', ko: '아직 없습니다. 화면의 버튼을 누르면 보낸 메시지가 여기에 나옵니다.' })
    : t({ en: 'This example has no buttons that send messages.', ko: '이 예제에는 메시지를 보내는 버튼이 없습니다.' });
  /* at this step, is there anything to draw: components sent, and the surface not deleted since */
  const applied = example.fixture.messages.slice(0, step);
  const drawn = applied.some((m) => 'updateComponents' in m) && !('deleteSurface' in applied[applied.length - 1]);
  const kind = kindOf(example.fixture.messages[step - 1]);
  /* components drawn, but the data they bind to comes in a later message: their values are empty for now */
  const dataLater = drawn && !applied.some((m) => 'updateDataModel' in m) && example.fixture.messages.slice(step).some((m) => 'updateDataModel' in m);
  const pick = (k: number) => { setStep(k); setTab('in'); };
  /* at either end the buttons stay focusable (aria-disabled) and a press does nothing: a disabled button would drop
     the focus out of the sheet */
  const first = step <= 1, last = step >= n;
  return (
    <div className="a2ui-inspector-wrap"><div className="a2ui-inspector">
      <section className="a2ui-inspector__view" aria-label={t({ en: 'Screen', ko: '화면' })}>
        <div className="a2ui-steps">
          <Text variant="subhead" className="a2ui-steps__label" aria-live="polite">
            {step === n ? t({ en: `All ${n} messages applied`, ko: `메시지 ${n}개 모두 적용` }) : t({ en: `Up to message ${step} of ${n}`, ko: `메시지 ${n}개 중 ${step}번째까지` })}
            <code className="a2ui-steps__kind" lang="en">{kind}</code>
          </Text>
          <div className="a2ui-steps__buttons">
            <IconButton size="sm" variant="plain" icon={<ChevronLeft size={18} />} label={t({ en: 'Previous message', ko: '이전 메시지' })} aria-disabled={first || undefined} onClick={() => { if (!first) pick(step - 1); }} />
            <IconButton size="sm" variant="plain" icon={<ChevronRight size={18} />} label={t({ en: 'Next message', ko: '다음 메시지' })} aria-disabled={last || undefined} onClick={() => { if (!last) pick(step + 1); }} />
            <Button size="sm" variant="plain" aria-disabled={last || undefined} onClick={() => { if (!last) pick(n); }}>{t({ en: 'All', ko: '전체' })}</Button>
          </div>
        </div>
        <div className="a2ui-inspector__stage">
          <Surfaces a2ui={a2ui} className="a2ui-inspector__surface" />
          {!drawn && <Text variant="footnote" tone="secondary" className="a2ui-inspector__note">
            {t({ en: 'Nothing on the screen yet: no components have been sent up to this message.', ko: '이 메시지까지는 화면에 그릴 컴포넌트가 없습니다.' })}
          </Text>}
          {dataLater && <Text variant="footnote" tone="secondary" className="a2ui-inspector__note">
            {t({ en: 'Data comes in a later message, so values bound to it are empty here.', ko: '데이터는 뒤 메시지에서 전달되므로 바인딩된 값은 아직 비어 있습니다.' })}
          </Text>}
          {!media && refused > 0 && <Text variant="footnote" tone="secondary" className="a2ui-inspector__note">
            {t({ en: refused === 1 ? '1 media item from another site was not loaded.' : `${refused} media items from other sites were not loaded.`, ko: `다른 사이트의 미디어 ${refused}개를 불러오지 않았습니다.` })}
          </Text>}
        </div>
      </section>
      <div className="a2ui-inspector__code">
        <Tabs variant="pill" aria-label="JSON" value={tab} onChange={setTab} panelClassName="a2ui-inspector__panel" items={[
          { value: 'in', label: inLabel, icon: <Bot size={16} aria-hidden />, badge: n, content: <Stream messages={example.fixture.messages} label={inLabel} about={aboutIn} empty="" step={step} onStep={pick} /> },
          { value: 'out', label: outLabel, icon: <MousePointerClick size={16} aria-hidden />, badge: sent.length || undefined, content: <Stream messages={sent as unknown as Message[]} label={outLabel} about={aboutOut}
            empty={emptyOut} /> },
        ]} />
      </div>
    </div></div>
  );
}

/* ── a card in the grid ── */

function ThumbSurface({ example, media }: { example: Example; media: boolean }) {
  const { a2ui } = useExample(example, media);
  return <Surfaces a2ui={a2ui} className="a2ui-thumb__surface" />;
}

/** true once the element has come within `margin` of the viewport, and from then on */
function useNear<E extends Element>(margin: string) {
  const ref = useRef<E>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    if (typeof IntersectionObserver !== 'function') { setNear(true); return; }
    const io = new IntersectionObserver((seen) => { if (seen.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}

function Thumb({ example, media, onOpen }: { example: Example; media: boolean; onOpen: () => void }) {
  /* each example is a session replayed when it mounts: only the cards near the screen are drawn (up to 600 px
     ahead, so scrolling meets them drawn), and a drawn card stays drawn. Until then the frame is an empty fill of the
     same size, so nothing moves when it draws. data-lazy: the e2e css-split brings each into view before comparing */
  const [frame, near] = useNear<HTMLSpanElement>('600px 0px');
  return (
    /* the surface holds controls of its own, so the card is not a button: the name is, and its hit area covers the
       card; the picture is inert and hidden from assistive technology. It is the surface scaled down, so its corners are
       not measured (e2e corners): at 0.58 the gaps and radii round apart; the surfaces are measured at full size */
    <Card variant="outlined" className="a2ui-thumb">
      <span ref={frame} className="a2ui-thumb__frame" inert aria-hidden="true" data-corners-skip="" data-lazy="">
        {near && <ThumbSurface example={example} media={media} />}
      </span>
      <span className="a2ui-thumb__label" lang="en">
        <button type="button" className="a2ui-thumb__open" data-slug={example.slug} onClick={onOpen}><Text variant="subhead" as="span">{example.name}</Text></button>
        {example.shown.length > 0 && <Text variant="caption" tone="secondary" as="span">{example.shown.join(' · ')}</Text>}
      </span>
    </Card>
  );
}

function useGallery() {
  const [version, setVersion] = useState<V>('1.0');
  const [media, setMedia] = useState(false);
  const [q, setQ] = useState('');
  const all = EXAMPLES[version];
  const shown = useMemo(() => all.filter((e) => matches(e, q)), [all, q]);
  return { version, setVersion, media, setMedia, q, setQ, all, shown, count: { shown: shown.length, all: all.length } };
}

/* ── the gallery: a grid, and an example opened in a sheet ── */

export function Gallery() {
  const g = useGallery();
  const [open, setOpen] = useState<Example | null>(null);
  const t = useT();
  return (
    <div className="a2ui-gallery">
      <Toolbar {...g} />
      <div className="a2ui-grid">
        {g.shown.map((e) => <Thumb key={`${g.version}/${e.slug}`} example={e} media={g.media} onOpen={() => setOpen(e)} />)}
      </div>
      {/* a screen reader on a touch screen has no Escape key and does not swipe the sheet away: the close button is its
          way out */}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? <span lang="en">{open.name}</span> : undefined} height="full" adaptive className="a2ui-sheet"
        leading={<IconButton size="sm" variant="plain" icon={<X size={18} />} label={t({ en: 'Close', ko: '닫기' })} onClick={() => setOpen(null)} />}
        trailing={<MediaSwitch media={g.media} setMedia={g.setMedia} />}>
        {open && (
          <div className="a2ui-sheet__body">
            {open.fixture.description && <Text variant="subhead" tone="secondary" lang="en" className="a2ui-sheet__about">{open.fixture.description}</Text>}
            <Inspector key={`${g.version}/${open.slug}`} example={open} media={g.media} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
