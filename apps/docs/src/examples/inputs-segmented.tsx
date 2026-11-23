import { useState } from 'react';
import { SegmentedControl } from '@satin-glass/react';
import { Bike, Car, Footprints } from 'lucide-react';

type Mode = 'walk' | 'cycle' | 'drive';

export default function Example() {
  const [mode, setMode] = useState<Mode>('walk');
  return (
    <SegmentedControl aria-label="Travel mode" value={mode} onChange={setMode}
      options={[
        { value: 'walk', label: 'Walk', icon: <Footprints /> },
        { value: 'cycle', label: 'Cycle', icon: <Bike /> },
        { value: 'drive', label: 'Drive', icon: <Car /> },
      ]} />
  );
}
