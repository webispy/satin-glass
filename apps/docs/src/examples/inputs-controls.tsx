import { useState } from 'react';
import { Slider, Stack, Stepper, Switch, Text } from '@satin-glass/react';

export default function Example() {
  const [offline, setOffline] = useState(true);
  const [radius, setRadius] = useState(5);
  const [guests, setGuests] = useState(2);
  return (
    <Stack gap={4} style={{ maxWidth: 360 }}>
      <Stack direction="row" justify="space-between" align="center">
        <Text>Offline maps</Text>
        {/* a switch shows no text of its own, so give it a name */}
        <Switch checked={offline} onChange={setOffline} aria-label="Offline maps" />
      </Stack>
      <Slider value={radius} onChange={setRadius} min={1} max={20}
        format={(v) => `${v} km`} aria-label="Search radius" />
      <Stepper value={guests} onChange={setGuests} min={1} max={12} label="Guests"
        format={(v) => (v === 1 ? '1 guest' : `${v} guests`)} />
    </Stack>
  );
}
