import { Button, Stack, useToast } from '@satin-glass/react';

/* wrap the app in <Toaster> once; useToast() then works anywhere inside it */
export default function Example() {
  const toast = useToast();
  return (
    <Stack direction="row" gap={2} wrap>
      <Button variant="neutral" onClick={() => toast({ title: 'Offline map downloaded', description: 'Seoul · 312 MB', tone: 'success' })}>
        Show a toast
      </Button>
      <Button variant="neutral" onClick={() => toast({ title: 'Connection lost', tone: 'danger', action: { label: 'Try again', onClick: () => {} } })}>
        Error with an action
      </Button>
    </Stack>
  );
}
