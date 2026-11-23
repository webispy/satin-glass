import { useState } from 'react';
import { Button, Dialog } from '@satin-glass/react';
import { Trash2 } from 'lucide-react';

export default function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="tinted" tone="danger" onClick={() => setOpen(true)}>Delete place…</Button>
      {/* Escape or an action closes it (add dismissible for the scrim too); focus returns to the button */}
      <Dialog open={open} onClose={() => setOpen(false)} icon={<Trash2 />} tone="danger" title="Delete this place?"
        actions={<>
          <Button variant="neutral" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="filled" tone="danger" onClick={() => setOpen(false)}>Delete</Button>
        </>}>
        Its photos and notes are deleted too, and this can't be undone.
      </Dialog>
    </>
  );
}
