/* A2UI (#62): a recorded agent turn in the A2UI protocol, drawn by @satin-glass/a2ui, with what would go back to the
   agent. The package is experimental and unpublished until both protocol versions' conformance fixtures pass. */
import { useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { A2uiSurfaces, useA2ui, type OutboundEnvelope } from '@satin-glass/a2ui';
import { Button, SegmentedControl, Stack, Text } from '@satin-glass/react';
import { Demo, Page, Section } from '../shared';
import { L, useT } from '../i18n';
import { alertTurn, deleteSurface, type Copy, type Version } from '../a2ui/fixtures';
import { Gallery } from '../a2ui/gallery';

type T = ReturnType<typeof useT>;
const copy = (t: T): Copy => ({
  title: t({ en: 'New alert', ko: '새 알림' }),
  intro: t({ en: 'I filled in what I could from the incident. Check the rest, then save.', ko: '장애 기록에서 알 수 있는 내용은 채워 두었습니다. 나머지를 확인하고 저장하세요.' }),
  name: t({ en: 'Alert name', ko: '알림 이름' }),
  namePlaceholder: t({ en: 'e.g. Checkout errors', ko: '예: 결제 오류' }),
  nameRequired: t({ en: 'Give the alert a name.', ko: '알림 이름을 입력하세요.' }),
  nameShort: t({ en: 'Use at least 3 characters.', ko: '3자 이상 입력하세요.' }),
  severity: t({ en: 'Severity', ko: '심각도' }),
  low: t({ en: 'Low', ko: '낮음' }), high: t({ en: 'High', ko: '높음' }), critical: t({ en: 'Critical', ko: '긴급' }),
  volume: t({ en: 'Sound volume', ko: '알림음 크기' }),
  email: t({ en: 'Also send an email', ko: '이메일로도 보내기' }),
  pause: t({ en: 'Pause until', ko: '일시 중지 기한' }),
  rulesButton: t({ en: 'What counts as an incident?', ko: '어떤 경우가 장애인가요?' }),
  rulesTitle: t({ en: 'What counts as an incident', ko: '장애로 보는 경우' }),
  rules: t({ en: 'An error rate above 2% for five minutes, or any failed payment.', ko: '5분 동안 오류율이 2%를 넘거나, 결제가 한 건이라도 실패한 경우입니다.' }),
  save: t({ en: 'Save alert', ko: '알림 저장' }),
  fix: t({ en: 'Fix the name before saving.', ko: '저장하기 전에 이름을 고치세요.' }),
  scope: t({ en: 'Covers 12 services in production.', ko: '운영 환경의 서비스 12개에 적용됩니다.' }),
});

/* the app gives the icons (the library draws only a minimal set of glyphs of its own) */
const ICONS = { notifications: <Bell size={22} strokeWidth={1.8} /> };

/* the recording is made when a replay starts, in the page's language (the docs mount each page again when the
   language changes, so a change of language starts a new replay) */
function Replay({ version, copy: c, run, del }: { version: Version; copy: Copy; run: number; del: number }) {
  const t = useT();
  const words = useRef(c); words.current = c;
  const [sent, setSent] = useState<OutboundEnvelope[]>([]);
  const a2ui = useA2ui({ onOutbound: (m) => setSent((l) => [...l, m]), icons: ICONS });
  const [model, setModel] = useState('');
  const pendingDelete = useRef<ReturnType<typeof setTimeout>>(undefined);
  /* busy until the turn's last message has arrived (the surface is still being built) */
  const [replaying, setReplaying] = useState(true);
  useEffect(() => {
    clearTimeout(pendingDelete.current);   // a deletion asked for in the replay before does not reach this one
    a2ui.reset();
    setSent([]);
    setReplaying(true);
    const turn = alertTurn(version, words.current), last = Math.max(...turn.map((s) => s.at));
    const timers = turn.map((s) => setTimeout(() => { a2ui.process(s.message); if (s.at === last) setReplaying(false); }, s.at));
    return () => timers.forEach(clearTimeout);
  }, [version, run, a2ui]);
  /* the deletion is asked for once per press, and a new replay (or another version) cancels it */
  useEffect(() => {
    if (!del) return;
    clearTimeout(pendingDelete.current);
    pendingDelete.current = setTimeout(() => a2ui.process(deleteSurface(version)), 3000);
  }, [del]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(pendingDelete.current), []);
  useEffect(() => {
    const poll = setInterval(() => setModel(JSON.stringify((a2ui.dataModel(version) as { surfaces?: unknown } | undefined)?.surfaces ?? {}, null, 1)), 250);
    return () => clearInterval(poll);
  });
  const ids = useId();
  return (
    <div className="a2ui-replay" aria-busy={replaying || undefined}>
      <A2uiSurfaces a2ui={a2ui} className="a2ui-replay__surface" />
      <div className="a2ui-replay__side">
        {/* each log scrolls: a region in the Tab order, named by its heading, so a keyboard can scroll it too */}
        <Text variant="subhead" as="h3" id={`${ids}-sent`}>{t({ en: 'Sent to the agent', ko: '에이전트로 보낸 메시지' })}</Text>
        <pre className="a2ui-log" data-a2ui-log="" tabIndex={0} role="region" aria-labelledby={`${ids}-sent`}>{sent.length ? sent.map((m) => JSON.stringify(m)).join('\n') : '—'}</pre>
        <Text variant="subhead" as="h3" id={`${ids}-model`}>{t({ en: 'Data model', ko: '데이터 모델' })}</Text>
        <pre className="a2ui-log" data-a2ui-model="" tabIndex={0} role="region" aria-labelledby={`${ids}-model`}>{model || '—'}</pre>
      </div>
    </div>
  );
}

export function A2ui() {
  const t = useT();
  const [version, setVersion] = useState<Version>('1.0');
  const [run, setRun] = useState(0);
  const [del, setDel] = useState(0);
  const c = copy(t);
  return (
    <Page title="A2UI" intro={<L
      en="Agents describe a user interface in the A2UI protocol; @satin-glass/a2ui draws it with Satin Glass controls, in the app's theme and language. It is experimental and not yet published (issue #62). Below, a recorded agent turn is replayed."
      ko="에이전트가 A2UI 프로토콜로 사용자 인터페이스를 기술하면, @satin-glass/a2ui는 이를 앱의 테마와 언어에 맞춰 Satin Glass 컨트롤로 그립니다. 아직 실험 단계이며 배포하지 않았습니다(이슈 #62). 아래에서는 기록해 둔 에이전트 응답을 재생합니다." />}>
      <Section title={t({ en: 'An agent turn', ko: '에이전트 응답' })} intro={<L
        en="The name field is bound to the data model and checked; the save button stays disabled, and says why, until the name passes. One line arrives about 1.6 seconds into the replay, after the rest. To check that focus and scrolling come back, press ‘Delete surface in 3 s’, then open the dialog before the 3 seconds are up."
        ko="이름 필드는 데이터 모델에 바인딩되어 있고 검사를 거칩니다. 이름이 검사를 통과할 때까지 저장 버튼은 비활성이며 그 이유를 함께 보여 줍니다. 한 줄은 재생을 시작하고 약 1.6초 뒤, 나머지보다 늦게 도착합니다. 포커스와 스크롤이 돌아오는지 확인하려면 ‘3초 뒤 서피스 삭제’를 누른 뒤 3초가 지나기 전에 대화상자를 여세요." />}>
        <Demo col data-demo="a2ui">
          <Stack direction="row" gap={2} align="center" wrap>
            <SegmentedControl size="sm" aria-label={t({ en: 'Protocol version', ko: '프로토콜 버전' })} value={version} onChange={(v) => setVersion(v as Version)}
              options={[{ value: '1.0', label: 'v1.0' }, { value: '0.9', label: 'v0.9.1' }]} />
            <Button size="sm" onClick={() => setRun((n) => n + 1)}>{t({ en: 'Replay', ko: '다시 재생' })}</Button>
            {/* in 3 s, so a dialog can be opened first (it makes the rest of the page inert) */}
            <Button size="sm" tone="danger" onClick={() => setDel((n) => n + 1)}>{t({ en: 'Delete surface in 3 s', ko: '3초 뒤 서피스 삭제' })}</Button>
          </Stack>
          <Replay version={version} copy={c} run={run} del={del} />
        </Demo>
      </Section>
      <Section title={t({ en: 'Examples from the A2UI project', ko: 'A2UI 프로젝트의 예제' })} intro={<L
        en={<>The basic catalog examples that the A2UI project publishes, for both protocol versions, are drawn by this package. The same files are replayed by its tests. Where the catalog leaves the look open, they take Satin Glass's: the outermost card is a surface card, an image at the top or bottom of a card fills it from side to side (press a cropped one to see it in full), and a short single choice is a segmented control. Their text is the project's own, in English. Source: <a href="https://github.com/a2ui-project/a2ui/tree/a23b19c4f2102695c506adb7d1ded1f5f81a7688/catalogs/basic" target="_blank" rel="noreferrer">a2ui-project/a2ui</a>, Apache License 2.0.</>}
        ko={<>A2UI 프로젝트가 공개한 두 프로토콜 버전의 기본 카탈로그 예제를 이 패키지로 그립니다. 패키지 테스트도 같은 파일을 재생합니다. 카탈로그가 모양을 정하지 않은 부분은 Satin Glass를 따릅니다. 가장 바깥 카드는 그림자가 있는 표면 카드로 그리고, 카드 위나 아래에 놓인 이미지는 여백 없이 양옆까지 채웁니다(잘린 이미지를 누르면 전체를 볼 수 있습니다). 선택지가 적은 단일 선택은 세그먼트 컨트롤로 그립니다. 예제의 문구는 프로젝트의 원문(영어) 그대로입니다. 출처: <a href="https://github.com/a2ui-project/a2ui/tree/a23b19c4f2102695c506adb7d1ded1f5f81a7688/catalogs/basic" target="_blank" rel="noreferrer">a2ui-project/a2ui</a>, Apache License 2.0.</>} />}>
        <Demo col data-demo="a2ui-gallery">
          <Gallery />
        </Demo>
      </Section>
    </Page>
  );
}
