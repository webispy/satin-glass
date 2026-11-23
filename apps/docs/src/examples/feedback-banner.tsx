import { useState } from 'react';
import { Banner, Button } from '@satin-glass/react';

export default function Example() {
  const [open, setOpen] = useState(true);
  return (
    <>
      {open ? (
        <Banner tone="info" title="Scheduled maintenance" onDismiss={() => setOpen(false)} dismissLabel="Dismiss notice">
          Order management will be unavailable for 30 minutes from 2 a.m.
        </Banner>
      ) : (
        <Button size="sm" variant="neutral" onClick={() => setOpen(true)}>Show the banner again</Button>
      )}
      {/* live: announce a banner that appears after the page has loaded */}
      <Banner tone="danger" title="Lost connection to the payment provider" live
        actions={<Button size="sm">Reconnect</Button>}>
        Payments for new orders are not being approved.
      </Banner>
    </>
  );
}
