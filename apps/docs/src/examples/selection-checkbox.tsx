import { useState } from 'react';
import { Checkbox, Stack } from '@satin-glass/react';

const toppings = [
  { value: 'cheese', label: 'Extra cheese' },
  { value: 'olives', label: 'Olives' },
  { value: 'basil', label: 'Fresh basil' },
];

export default function Example() {
  const [chosen, setChosen] = useState<string[]>(['olives']);
  const all = chosen.length === toppings.length;
  const toggle = (value: string, on: boolean) =>
    setChosen((list) => (on ? [...list, value] : list.filter((v) => v !== value)));
  return (
    <Stack gap={3}>
      {/* the parent shows a dash while only some are chosen */}
      <Checkbox label="All toppings" checked={all} indeterminate={chosen.length > 0 && !all}
        onChange={(on) => setChosen(on ? toppings.map((t) => t.value) : [])} />
      <Stack gap={3} style={{ paddingLeft: 32 }}>
        {toppings.map((t) => (
          <Checkbox key={t.value} name="toppings" value={t.value} label={t.label}
            checked={chosen.includes(t.value)} onChange={(on) => toggle(t.value, on)} />
        ))}
      </Stack>
      <Checkbox label="Send me offers" description="About once a month. You can stop any time." />
    </Stack>
  );
}
