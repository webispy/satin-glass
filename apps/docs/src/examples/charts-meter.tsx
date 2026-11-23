import { Meter, Stack } from '@satin-glass/react';

export default function Example() {
  const used = 37.4;
  return (
    <Stack gap={4}>
      {/* bands as in HTML's <meter>: warning from 30 GB, bad from 45 GB, and less is better */}
      <Meter label="Storage" value={used} max={50} low={30} high={45} optimum={0}
        format={(v) => `${v.toFixed(1)} GB / 50 GB`} status={`${(50 - used).toFixed(1)} GB left`} />
      <Meter label="Customer satisfaction" value={4.3} min={1} max={5} low={3} high={4} optimum={5}
        format={(v) => `${v.toFixed(1)} / 5`} status="Good · up 0.2 on last month" />
      {/* no value yet: the meter says so instead of showing zero */}
      <Meter label="Response time target" value={Number.NaN} labels={{ unavailable: 'Unknown' }} status="Measuring" />
    </Stack>
  );
}
