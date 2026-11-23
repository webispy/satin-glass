import { useState } from 'react';
import { DateRangePicker, type DateRange, Stack } from '@satin-glass/react';

export default function Example() {
  const [stay, setStay] = useState<DateRange | null>(null);
  const today = new Date();
  return (
    <Stack gap={4} style={{ maxWidth: 360 }}>
      <DateRangePicker
        label="Stay"
        unit="nights"
        labels={{ start: 'check-in', end: 'check-out' }}
        minLength={1}
        maxLength={14}
        min={today}
        value={stay}
        onChange={setStay}
        name="stay"
        helperText="Up to 14 nights"
      />
    </Stack>
  );
}
