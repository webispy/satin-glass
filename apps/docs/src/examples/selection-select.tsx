import { useState } from 'react';
import { Select, Stack } from '@satin-glass/react';
import { Bike, Car, Footprints } from 'lucide-react';

export default function Example() {
  const [mode, setMode] = useState('walk');
  const [city, setCity] = useState<string | null>(null);
  return (
    <Stack gap={4} style={{ maxWidth: 360 }}>
      <Select label="Travel mode" value={mode} onChange={setMode} options={[
        { value: 'walk', label: 'Walk', icon: <Footprints /> },
        { value: 'bike', label: 'Cycle', icon: <Bike /> },
        { value: 'car', label: 'Drive', icon: <Car />, description: 'Only where you can park' },
      ]} />
      {/* groups label a run of options; name submits the value with a form */}
      <Select label="City" placeholder="Choose a city" value={city} onChange={setCity} name="city"
        helperText="Places are narrowed to this city" options={[
          { label: 'North', options: [{ value: 'seoul', label: 'Seoul' }, { value: 'incheon', label: 'Incheon' }] },
          { label: 'South', options: [{ value: 'busan', label: 'Busan' }, { value: 'jeju', label: 'Jeju', disabled: true }] },
        ]} />
    </Stack>
  );
}
