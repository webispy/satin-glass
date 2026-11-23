import { useState } from 'react';
import { Button, Menu, MenuItem, MenuLabel, MenuSeparator } from '@satin-glass/react';
import { Bike, Car, Copy, Footprints } from 'lucide-react';

export default function Example() {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [mode, setMode] = useState('walk');
  return (
    <>
      <Button ref={setAnchor} variant="tinted" startIcon={<Footprints />}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>Directions</Button>
      <Menu open={open} onClose={() => setOpen(false)} anchor={anchor} aria-label="Travel mode">
        <MenuLabel>Travel mode</MenuLabel>
        <MenuItem icon={<Footprints />} checked={mode === 'walk'} onSelect={() => setMode('walk')}>Walk</MenuItem>
        <MenuItem icon={<Bike />} checked={mode === 'cycle'} onSelect={() => setMode('cycle')}>Cycle</MenuItem>
        <MenuItem icon={<Car />} checked={mode === 'drive'} onSelect={() => setMode('drive')} hint="12 min">Drive</MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Copy />} onSelect={() => navigator.clipboard?.writeText('Heron Point')}>Copy address</MenuItem>
      </Menu>
    </>
  );
}
