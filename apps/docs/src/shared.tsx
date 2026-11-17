import type { CSSProperties, ReactNode } from 'react';
import { Text } from '@glass-layer/react';

export function Page({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <article className="docs__page">
      <header>
        <Text variant="display">{title}</Text>
        {intro && <Text variant="callout" tone="secondary" style={{ marginTop: 8 }}>{intro}</Text>}
      </header>
      {children}
    </article>
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

export function Demo({ children, col, center, media, style, caption }: { children: ReactNode; col?: boolean; center?: boolean; media?: boolean; style?: CSSProperties; caption?: ReactNode }) {
  return (
    <div className={['demo', col && 'demo--col', center && 'demo--center', media && 'demo--media'].filter(Boolean).join(' ')} style={style}>
      {children}
      {caption && <p className="demo__caption">{caption}</p>}
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
  const k = scene % SCENES.length, s = SCENES[k], id = `ph${k}`;
  return (
    <div className={['photo', className].filter(Boolean).join(' ')} role="img" aria-label="풍경 사진" style={style}>
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
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
