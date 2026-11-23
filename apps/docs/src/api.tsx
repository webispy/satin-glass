/* A component's options, from the types (scripts/docs-props.mjs writes generated/props.json). The descriptions are
   the JSDoc on each prop, in English in both languages for now (marked lang="en" in the Korean pages). */
import { Text } from '@satin-glass/react';
import PROPS from './generated/props.json';
import { useLang, useT } from './i18n';

type Prop = { name: string; type: string; required: boolean; default: string | null; description: string; common?: boolean };
type Entry = { kind: 'component' | 'type'; category: string; description: string; props: Prop[]; inherits: string[] };
const ALL = PROPS as Record<string, Entry>;

export function ApiTable({ name }: { name: string }) {
  const t = useT(), lang = useLang();
  const e = ALL[name];
  if (!e) return <Text tone="secondary">{name}: {t({ en: 'no type information', ko: '타입 정보 없음' })}</Text>;
  const en = lang === 'ko' ? 'en' : undefined;
  return (
    <div className="api" data-api={name}>
      <Text variant="headline" as="h3" id={`api-${name}`}>
        <code>{name}</code>
        <span className="api__kind">{e.kind === 'type' ? t({ en: 'type', ko: '타입' }) : `@satin-glass/react/${e.category}`}</span>
      </Text>
      {e.description && <p className="api__desc" lang={en}>{e.description}</p>}
      {e.props.length === 0 ? <p className="api__desc">{t({ en: 'No options of its own.', ko: '자체 옵션은 없습니다.' })}</p> : (
      <div className="api__scroll" tabIndex={0} role="region" aria-label={t({ en: `${name} options`, ko: `${name} 옵션` })}>
        <table className="api__table">
          <thead><tr>
            <th scope="col">{t({ en: 'Option', ko: '옵션' })}</th>
            <th scope="col">{t({ en: 'Type', ko: '타입' })}</th>
            <th scope="col">{t({ en: 'Default', ko: '기본값' })}</th>
            <th scope="col">{t({ en: 'Description', ko: '설명' })}</th>
          </tr></thead>
          <tbody>
            {e.props.map((p) => (
              <tr key={p.name}>
                <th scope="row"><code>{p.name}</code>{p.required && <span className="api__req" title={t({ en: 'required', ko: '필수' })}>{t({ en: 'required', ko: '필수' })}</span>}</th>
                <td><code className="api__type">{p.type}</code></td>
                <td>{p.default ? <code>{p.default}</code> : <span className="api__none">–</span>}</td>
                <td lang={en}>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {e.inherits.length > 0 && (
        <p className="api__inherits">{t({ en: 'Also takes the attributes of its root element', ko: '루트 요소의 속성도 받습니다' })}: {e.inherits.map((i) => <code key={i}>{i}</code>)}</p>
      )}
    </div>
  );
}

/** A page's API tab: one table per component or type. */
export function Api({ names }: { names: string[] }) {
  const t = useT();
  return (
    <div className="api-list">
      <Text variant="subhead" tone="secondary" as="p">{t({ en: 'Every option, from the TypeScript types.', ko: 'TypeScript 타입에서 생성한 전체 옵션입니다.' })}</Text>
      {names.map((n) => <ApiTable key={n} name={n} />)}
    </div>
  );
}
