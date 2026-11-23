import { useState } from 'react';
import { Button, Drawer, ListItem, Select, Stack, Switch } from '@satin-glass/react';

export default function Example() {
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<string | null>('new');
  const [allDay, setAllDay] = useState(false);
  return (
    <>
      <Button variant="filled" onClick={() => setOpen(true)}>Open filters</Button>
      {/* side: 'end' (default) or 'start'; 'top' and 'bottom' for tool panels */}
      <Drawer open={open} onClose={() => setOpen(false)} title="Filters" labels={{ close: 'Close' }}>
        <Stack gap={5}>
          <Select label="Sort" value={sort} onChange={setSort}
            options={[{ value: 'new', label: 'Newest' }, { value: 'near', label: 'Nearest' }]} />
          <ListItem title="Open 24 hours"
            trailing={<Switch checked={allDay} onChange={setAllDay} aria-label="Open 24 hours" />} />
          <Button variant="filled" onClick={() => setOpen(false)}>Show results</Button>
        </Stack>
      </Drawer>
    </>
  );
}
