import { useState } from 'react';
import { Button, Stack } from '@satin-glass/react';
import { Trash2 } from 'lucide-react';

export default function Example() {
  const [saving, setSaving] = useState(false);
  const save = () => { setSaving(true); setTimeout(() => setSaving(false), 1200); };
  return (
    <Stack direction="row" gap={2} align="center" wrap>
      {/* one filled button per view, for the main action */}
      <Button variant="filled" loading={saving} onClick={save}>Save</Button>
      {/* tinted is the default */}
      <Button>Edit</Button>
      <Button variant="plain">Cancel</Button>
      <Button variant="tinted" tone="danger" startIcon={<Trash2 />}>Delete</Button>
      <Button size="sm" variant="neutral" disabled>Archive</Button>
    </Stack>
  );
}
