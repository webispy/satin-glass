/* Display settings shared by the docs chrome and the showcase's own settings sheet. */
import { createContext, useContext, type ReactNode } from 'react';
import { List, ListItem, ListSection, SegmentedControl, Stack, Switch, type GrooveStyle, type ThemeMode } from '@satin-glass/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { MotionName } from '@satin-glass/tokens';
import { useLang, useSetLang, useT } from './i18n';

export type DisplaySettings = {
  mode: ThemeMode; setMode: (v: ThemeMode) => void;
  motion: MotionName; setMotion: (v: MotionName) => void;
  grooves: GrooveStyle; setGrooves: (v: GrooveStyle) => void;
  hc: boolean; setHc: (v: boolean) => void;
  rm: boolean; setRm: (v: boolean) => void;
  rt: boolean; setRt: (v: boolean) => void;
};
const Ctx = createContext<DisplaySettings | null>(null);
export const DisplaySettingsProvider = ({ value, children }: { value: DisplaySettings; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useDisplaySettings = () => useContext(Ctx)!;

/* option lists in the reader's language; the language switch names each language in itself */
function useOptions() {
  const t = useT();
  return {
    MODES: [{ value: 'light' as const, label: t({ en: 'Light', ko: '라이트' }) }, { value: 'dark' as const, label: t({ en: 'Dark', ko: '다크' }) }, { value: 'system' as const, label: t({ en: 'System', ko: '시스템' }) }],
    MOTIONS: [{ value: 'calm' as const, label: t({ en: 'Calm', ko: '차분' }) }, { value: 'lively' as const, label: t({ en: 'Lively', ko: '생동' }) }, { value: 'playful' as const, label: t({ en: 'Playful', ko: '경쾌' }) }],
    GROOVES: [{ value: 'inset' as const, label: t({ en: 'Inset', ko: '오목' }) }, { value: 'flat' as const, label: t({ en: 'Flat', ko: '평면' }) }],
    /* each language named in itself, and marked so, so a screen reader says it in that language */
    LANGS: [{ value: 'en' as const, label: <span lang="en">English</span> }, { value: 'ko' as const, label: <span lang="ko">한국어</span> }],
    n: {
      mode: t({ en: 'Appearance', ko: '화면 모드' }), motion: t({ en: 'Motion', ko: '모션' }), grooves: t({ en: 'Grooves', ko: '홈' }), lang: t({ en: 'Language', ko: '언어' }),
      hc: t({ en: 'High contrast', ko: '고대비' }), rm: t({ en: 'Reduce motion', ko: '동작 줄이기' }), rt: t({ en: 'Reduce transparency', ko: '투명도 줄이기' }),
      /* the bar's shorter words for the same switches (their accessible names stay the full ones) */
      hcShort: t({ en: 'High contrast', ko: '고대비' }), rmShort: t({ en: 'Less motion', ko: '동작 줄이기' }), rtShort: t({ en: 'Opaque', ko: '투명도 줄이기' }),
      vdi: t({ en: 'On a remote desktop (VDI) or while sharing the screen, turning on both Reduce motion and Reduce transparency cuts stutter.', ko: '원격 데스크톱(VDI)이나 화면 공유 중에는 ‘동작 줄이기’와 ‘투명도 줄이기’를 함께 켜면 끊김이 줄어요.' }),
      screen: t({ en: 'Display', ko: '화면' }),
    },
  };
}

const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor };

/** One row, for a wide toolbar. */
export function DisplaySettingsBar() {
  const s = useDisplaySettings();
  const { MODES, MOTIONS, GROOVES, n } = useOptions();
  return (
    <>
      {/* appearance as icons (sun, moon, screen): the words name the segments and show as their tooltips */}
      <SegmentedControl size="sm" iconOnly aria-label={n.mode} value={s.mode} onChange={s.setMode}
        options={MODES.map((m) => { const Icon = MODE_ICONS[m.value]; return { ...m, icon: <Icon aria-hidden="true" /> }; })} />
      <SegmentedControl size="sm" aria-label={n.motion} value={s.motion} onChange={s.setMotion} options={MOTIONS} />
      <SegmentedControl size="sm" aria-label={n.grooves} value={s.grooves} onChange={s.setGrooves} options={GROOVES} />
      <label>{n.hcShort} <Switch size="sm" checked={s.hc} onChange={s.setHc} aria-label={n.hc} /></label>
      <label>{n.rmShort} <Switch size="sm" checked={s.rm} onChange={s.setRm} aria-label={n.rm} /></label>
      <label>{n.rtShort} <Switch size="sm" checked={s.rt} onChange={s.setRt} aria-label={n.rt} /></label>
    </>
  );
}

/** Stacked, for a popover or a settings sheet. */
export function DisplaySettingsList({ header }: { header?: string }) {
  const s = useDisplaySettings(), lang = useLang(), setLang = useSetLang();
  const { MODES, MOTIONS, GROOVES, LANGS, n } = useOptions();
  return (
    <Stack gap={4}>
      <ListSection header={header ?? n.screen}>
        <Stack gap={3} style={{ padding: '0 4px' }}>
          <SegmentedControl aria-label={n.lang} value={lang} onChange={setLang} options={LANGS} />
          <SegmentedControl aria-label={n.mode} value={s.mode} onChange={s.setMode} options={MODES} />
          <SegmentedControl aria-label={n.motion} value={s.motion} onChange={s.setMotion} options={MOTIONS} />
          <SegmentedControl aria-label={n.grooves} value={s.grooves} onChange={s.setGrooves} options={GROOVES} />
        </Stack>
      </ListSection>
      <ListSection footer={n.vdi}>
        <List>
          <ListItem title={n.hc} trailing={<Switch checked={s.hc} onChange={s.setHc} aria-label={n.hc} />} />
          <ListItem title={n.rm} trailing={<Switch checked={s.rm} onChange={s.setRm} aria-label={n.rm} />} />
          <ListItem title={n.rt} trailing={<Switch checked={s.rt} onChange={s.setRt} aria-label={n.rt} />} />
        </List>
      </ListSection>
    </Stack>
  );
}

/** The language switch, under the brand in the sidebar (each language named in itself). */
export function LanguageSwitch() {
  const lang = useLang(), setLang = useSetLang();
  const { LANGS, n } = useOptions();
  return <SegmentedControl size="sm" className="docs__lang" aria-label={n.lang} value={lang} onChange={setLang} options={LANGS} />;
}
