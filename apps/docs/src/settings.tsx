/* Display settings shared by the docs chrome and the showcase's own settings sheet. */
import { createContext, useContext, type ReactNode } from 'react';
import { List, ListItem, ListSection, SegmentedControl, Stack, Switch, type ThemeMode } from '@glass-layer/react';
import type { MotionName } from '@glass-layer/tokens';

export type DisplaySettings = {
  mode: ThemeMode; setMode: (v: ThemeMode) => void;
  motion: MotionName; setMotion: (v: MotionName) => void;
  hc: boolean; setHc: (v: boolean) => void;
  rm: boolean; setRm: (v: boolean) => void;
  rt: boolean; setRt: (v: boolean) => void;
};
const Ctx = createContext<DisplaySettings | null>(null);
export const DisplaySettingsProvider = ({ value, children }: { value: DisplaySettings; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useDisplaySettings = () => useContext(Ctx)!;

const MODES = [{ value: 'light' as const, label: '라이트' }, { value: 'dark' as const, label: '다크' }, { value: 'system' as const, label: '시스템' }];
const MOTIONS = [{ value: 'calm' as const, label: '차분' }, { value: 'lively' as const, label: '생동' }, { value: 'playful' as const, label: '경쾌' }];

/** One row, for a wide toolbar. */
export function DisplaySettingsBar() {
  const s = useDisplaySettings();
  return (
    <>
      <SegmentedControl size="sm" aria-label="화면 모드" value={s.mode} onChange={s.setMode} options={MODES} />
      <SegmentedControl size="sm" aria-label="모션" value={s.motion} onChange={s.setMotion} options={MOTIONS} />
      <label>고대비 <Switch size="sm" checked={s.hc} onChange={s.setHc} aria-label="고대비" /></label>
      <label>동작 줄이기 <Switch size="sm" checked={s.rm} onChange={s.setRm} aria-label="동작 줄이기" /></label>
      <label>투명도 줄이기 <Switch size="sm" checked={s.rt} onChange={s.setRt} aria-label="투명도 줄이기" /></label>
    </>
  );
}

/** Stacked, for a popover or a settings sheet. */
export function DisplaySettingsList({ header = '화면' }: { header?: string }) {
  const s = useDisplaySettings();
  return (
    <Stack gap={4}>
      <ListSection header={header}>
        <Stack gap={3} style={{ padding: '0 4px' }}>
          <SegmentedControl aria-label="화면 모드" value={s.mode} onChange={s.setMode} options={MODES} />
          <SegmentedControl aria-label="모션" value={s.motion} onChange={s.setMotion} options={MOTIONS} />
        </Stack>
      </ListSection>
      <ListSection footer="원격 데스크톱(VDI)이나 화면 공유 중에는 동작 줄이기와 투명도 줄이기를 함께 켜면 끊김이 줄어요.">
        <List>
          <ListItem title="고대비" trailing={<Switch checked={s.hc} onChange={s.setHc} aria-label="고대비" />} />
          <ListItem title="동작 줄이기" trailing={<Switch checked={s.rm} onChange={s.setRm} aria-label="동작 줄이기" />} />
          <ListItem title="투명도 줄이기" trailing={<Switch checked={s.rt} onChange={s.setRt} aria-label="투명도 줄이기" />} />
        </List>
      </ListSection>
    </Stack>
  );
}
