import { useState } from 'react';
import { DatePicker } from '@satin-glass/react';

export default function Example() {
  const [birth, setBirth] = useState<Date | null>(null);
  const [visit, setVisit] = useState<Date | null>(null);
  const today = new Date();
  const inThreeMonths = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
  return (
    <>
      {/* a date long past: open on the year, in a decade people are likely to pick */}
      <DatePicker label="Date of birth" value={birth} onChange={setBirth}
        openTo="year" defaultMonth={new Date(1990, 0, 1)} min={new Date(1920, 0, 1)} max={today} name="birth" />
      {/* only weekdays, from today up to three months ahead */}
      <DatePicker label="Visit date" weekStartsOn={1} value={visit} onChange={setVisit}
        min={today} max={inThreeMonths} isDateDisabled={(d) => d.getDay() === 0 || d.getDay() === 6}
        helperText="Weekdays, within 3 months" name="visit" />
    </>
  );
}
