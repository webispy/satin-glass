import { LineChart } from '@satin-glass/react';

const data = [
  { day: '11/1', visits: 4210, returning: 1460 },
  { day: '11/2', visits: 5480, returning: 1890 },
  { day: '11/3', visits: 4390, returning: 1530 },
  { day: '11/4', visits: 4520, returning: 1610 },
  { day: '11/5', visits: 4610, returning: 1650 },
  { day: '11/6', visits: 4700, returning: 1720 },
  { day: '11/7', visits: 4580, returning: 1690 },
];

export default function Example() {
  return (
    <LineChart aria-label="Daily visits and return visits" data={data} x="day" area height={200}
      series={[{ key: 'visits', label: 'Visits' }, { key: 'returning', label: 'Return visits' }]}
      yFormat={(v) => v.toLocaleString('en-US')} caption="First week of November." />
  );
}
