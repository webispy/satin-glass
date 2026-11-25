import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Accordion, Button, IconButton, Menu, MenuItem, Tabs, Text, useToast } from '@satin-glass/react';
import { Api } from './api';
import { AppWindow, ChevronDown, Copy, FileCode2, ListTree, SquareTerminal } from 'lucide-react';
import { useT } from './i18n';

/** A docs page. With `api` it has two tabs, the demos and the API (#/page/api), and a contents list of the open tab:
    a rail at the side on wide screens, a button in the floating top bar on narrower ones. */
export function Page({ title, intro, api, children }: { title: string; intro?: ReactNode; api?: string[]; children: ReactNode }) {
  const t = useT();
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => { const on = () => setHash(location.hash); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  const [, id, sub] = hash.replace(/^#\/?/, '#/').split('/');
  const tab: 'demos' | 'api' = api && sub === 'api' ? 'api' : 'demos';
  const body = useRef<HTMLDivElement>(null);
  return (
    <article className={['docs__page', 'docs__page--toc'].join(' ')}>
      <div className="docs__content">
        <header>
          <Text variant="display">{title}</Text>
          {intro && <Text variant="callout" tone="secondary" style={{ marginTop: 8 }}>{intro}</Text>}
        </header>
        <div ref={body}>
          {api ? (
            <Tabs className="docs__tabs" aria-label={t({ en: 'Page sections', ko: '페이지 구성' })} value={tab}
              onChange={(v) => { location.hash = `#/${id}${v === 'api' ? '/api' : ''}`; }}
              items={[
                { value: 'demos', label: t({ en: 'Demos', ko: '데모' }), content: children },
                { value: 'api', label: 'API', content: <Api names={api} /> },
              ]} />
          ) : children}
        </div>
      </div>
      <Contents root={body} tab={tab} />
    </article>
  );
}

/* the open tab's sections: what it holds, where the reader is (the last heading above the upper third of the view),
   and a jump to each. Headings are found in the rendered page, so a page lists nothing by hand. Wide screens list them
   in a rail beside the page; narrower ones get a button in the floating top bar, so the list is in reach wherever the
   page is scrolled, and the button names the section in view. */
function Contents({ root, tab }: { root: RefObject<HTMLDivElement | null>; tab: string }) {
  const t = useT();
  const [heads, setHeads] = useState<{ id: string; text: string; sub: boolean }[]>([]);
  const [at, setAt] = useState<string | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  useEffect(() => setSlot(document.getElementById('docs-contents-slot')), []);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const read = () => {
      const hs = [...el.querySelectorAll<HTMLElement>('section > h2, .api > h3')];
      hs.forEach((h, i) => { if (!h.id) h.id = `sec-${tab}-${i}`; });
      setHeads(hs.map((h) => ({ id: h.id, text: (h.querySelector('code')?.textContent ?? h.textContent ?? '').trim(), sub: h.tagName === 'H3' })));
    };
    read();
    /* read again only when a heading comes, goes or changes its text: a virtual table or a streaming log on the page
       adds and removes nodes every frame, and reading each time rendered this list and its menu again in every frame
       of a scroll */
    const HEAD = 'section > h2, .api > h3', HOLDS = 'h2, h3, section, .api';
    const touches = (n: Node) => n.nodeType === 1 && ((n as Element).matches(HOLDS) || (n as Element).querySelector(HOLDS) !== null);
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        /* inside a heading (its text, or a node in it), or a heading taken from its section */
        const at = r.target.nodeType === 1 ? r.target as Element : r.target.parentElement;
        if (at?.closest(HEAD) || at?.matches('section, .api')) return read();
        for (const list of [r.addedNodes, r.removedNodes]) for (let i = 0; i < list.length; i++) if (touches(list[i])) return read();
      }
    });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    const onScroll = () => {
      const line = innerHeight / 3;
      let cur: string | null = null;
      for (const h of el.querySelectorAll<HTMLElement>('section > h2, .api > h3')) if (h.getBoundingClientRect().top < line) cur = h.id;
      setAt(cur);
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => { mo.disconnect(); removeEventListener('scroll', onScroll); };
  }, [root, tab]);
  if (heads.length < 2) return null;
  const go = (hid: string) => document.getElementById(hid)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const label = t({ en: 'On this page', ko: '이 페이지에서' });
  const current = heads.find((h) => h.id === at);
  return (
    <>
      <nav className="docs__toc" aria-label={label}>
        <p>{label}</p>
        <ul>
          {heads.map((h) => (
            <li key={h.id}><a href={`#${h.id}`} aria-current={h.id === at ? 'location' : undefined} data-sub={h.sub || undefined}
              onClick={(e) => { e.preventDefault(); go(h.id); }}>{h.text}</a></li>
          ))}
        </ul>
      </nav>
      {slot && createPortal(
        <>
          <Button ref={setBtn} variant="glass" className="docs__contents-btn" startIcon={<ListTree />} endIcon={<ChevronDown />}
            aria-haspopup="menu" aria-expanded={open} aria-label={current ? `${label}: ${current.text}` : label} onClick={() => setOpen((v) => !v)}>
            <span className="docs__contents-cur">{current?.text ?? label}</span>
          </Button>
          <Menu open={open} onClose={() => setOpen(false)} anchor={btn} placement="bottom-start" aria-label={label} className="docs__contents-menu">
            {heads.map((h) => (
              <MenuItem key={h.id} aria-current={h.id === at ? 'location' : undefined} className={h.sub ? 'docs__contents-sub' : undefined} onSelect={() => go(h.id)}>{h.text}</MenuItem>
            ))}
          </Menu>
        </>, slot)}
    </>
  );
}

export function Section({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <Text variant="title-3" as="h2">{title}</Text>
      {intro && <Text variant="subhead" tone="secondary" as="p">{intro}</Text>}
      {children}
    </section>
  );
}

export function Demo({ children, col, center, media, style, caption, ...rest }: { children: ReactNode; col?: boolean; center?: boolean; media?: boolean; style?: CSSProperties; caption?: ReactNode; [data: `data-${string}`]: string | undefined }) {
  return (
    <div className={['demo', col && 'demo--col', center && 'demo--center', media && 'demo--media'].filter(Boolean).join(' ')} style={style} {...rest}>
      {children}
      {caption && <p className="demo__caption">{caption}</p>}
    </div>
  );
}

/* what a code block holds, in words and an icon: a command for the terminal, or a file's kind */
const CODE_KINDS = {
  shell: { icon: SquareTerminal, en: 'Terminal', ko: '터미널' },
  tsx: { icon: FileCode2, en: 'TSX', ko: 'TSX' },
  css: { icon: FileCode2, en: 'CSS', ko: 'CSS' },
  html: { icon: FileCode2, en: 'HTML', ko: 'HTML' },
} as const;

/** A block of code to read and copy: a groove (it holds text the reader takes) with a quiet top line naming what it
    holds and the copy button, so the button never sits on the code. */
export function Code({ children, lang = 'tsx' }: { children: string; lang?: keyof typeof CODE_KINDS }) {
  const t = useT(), toast = useToast();
  const kind = CODE_KINDS[lang], Icon = kind.icon;
  const copy = () => navigator.clipboard?.writeText(children).then(() => toast({ title: t({ en: 'Copied', ko: '복사했어요' }) }), () => {});
  return (
    <figure className="codeblock">
      <figcaption className="codeblock__head">
        <Icon aria-hidden="true" /><span>{t(kind)}</span>
        <IconButton className="codeblock__copy" size="sm" icon={<Copy />} label={t({ en: 'Copy code', ko: '코드 복사' })} onClick={copy} />
      </figcaption>
      <pre tabIndex={0}><code>{children.replace(/^\n|\n\s*$/g, '')}</code></pre>
    </figure>
  );
}

/** How to use it: a small example module, run live and shown as the code it is (the same file, imported with ?raw),
    so the code on the page is the code that runs and can be copied whole. */
export function Usage({ title, example: Example, code }: { title?: ReactNode; example: ComponentType; code: string }) {
  const t = useT();
  /* the live example mounts when first opened (and stays, so closing shows it folding away): a closed card costs
     nothing, and the page's own demos are the only instances a reader or a test meets until then */
  const [seen, setSeen] = useState(false);
  return (
    <div className="usage">
      <Accordion onChange={(open) => { if (open.length) setSeen(true); }} items={[{
        value: 'usage', title: title ?? t({ en: 'Usage: example and code', ko: '사용법: 예제와 코드' }),
        content: (
          <div className="usage__body">
            <figure className="usage__preview">
              <figcaption className="usage__preview-head"><AppWindow aria-hidden="true" /><span>{t({ en: 'Preview', ko: '미리보기' })}</span></figcaption>
              <div className="usage__live">{seen && <Example />}</div>
            </figure>
            <Code lang="tsx">{code}</Code>
          </div>
        ),
      }]} />
    </div>
  );
}

/* Generated "photos": an SVG landscape per scene (no image files, scales to any box) */
const SCENES = [
  { sky: ['#5b8def', '#b7a6ff', '#ffd0b0'], sun: '#fff4d6', far: '#7c83e0', mid: '#4b4fb3', near: '#272a6e', sx: 0.72, sy: 0.3 },
  { sky: ['#ff8a5c', '#ffc07f', '#ffe3b3'], sun: '#fff8e0', far: '#e2785a', mid: '#b5443d', near: '#5c1d2e', sx: 0.3, sy: 0.42 },
  { sky: ['#3fbfa8', '#9fe6cf', '#e6fff2'], sun: '#ffffff', far: '#5cb49b', mid: '#1f8a6e', near: '#0b4a40', sx: 0.66, sy: 0.24 },
  { sky: ['#15173f', '#4d3a85', '#e9849d'], sun: '#ffd6e0', far: '#3a3d82', mid: '#25275c', near: '#0e0f28', sx: 0.5, sy: 0.6 },
  { sky: ['#8cc8ff', '#d9eeff', '#ffffff'], sun: '#ffffff', far: '#a3bfdc', mid: '#6d8fb6', near: '#3c5576', sx: 0.22, sy: 0.28 },
  { sky: ['#f2b93b', '#ffdb86', '#fff2c4'], sun: '#ffffff', far: '#d99a4e', mid: '#b0662a', near: '#55290f', sx: 0.78, sy: 0.36 },
];
export function Photo({ scene = 0, style, className, children }: { scene?: number; style?: CSSProperties; className?: string; children?: ReactNode }) {
  const t = useT();
  const k = scene % SCENES.length, s = SCENES[k], id = `ph${k}`;
  return (
    <div className={['photo', className].filter(Boolean).join(' ')} style={style}>
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label={t({ en: 'Landscape photo', ko: '풍경 사진' })} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.sky[0]} /><stop offset="0.6" stopColor={s.sky[1]} /><stop offset="1" stopColor={s.sky[2]} /></linearGradient>
          <radialGradient id={`${id}g`}><stop offset="0" stopColor={s.sun} stopOpacity="0.95" /><stop offset="0.35" stopColor={s.sun} stopOpacity="0.5" /><stop offset="1" stopColor={s.sun} stopOpacity="0" /></radialGradient>
          <linearGradient id={`${id}n`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.near} stopOpacity="0.85" /><stop offset="1" stopColor={s.near} /></linearGradient>
        </defs>
        <rect width="400" height="260" fill={`url(#${id}s)`} />
        <circle cx={400 * s.sx} cy={260 * s.sy} r="120" fill={`url(#${id}g)`} />
        <circle cx={400 * s.sx} cy={260 * s.sy} r="16" fill={s.sun} />
        <path d="M0 170 L60 128 L105 150 L170 96 L232 140 L290 112 L350 146 L400 124 L400 260 L0 260Z" fill={s.far} opacity="0.75" />
        <path d="M0 196 L48 170 L118 186 L182 150 L246 184 L318 160 L400 182 L400 260 L0 260Z" fill={s.mid} />
        <path d="M0 226 C70 206 130 214 200 222 C270 230 330 210 400 214 L400 260 L0 260Z" fill={`url(#${id}n)`} />
      </svg>
      {children}
    </div>
  );
}
export const sceneTint = (scene: number) => ['#6f7be0', '#e07a55', '#3fb39a', '#5b3f8f', '#86aee0', '#e0a53a'][scene % 6];
