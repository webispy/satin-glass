import { useState } from 'react';
import { Button, Timeline, TimelineItem } from '@satin-glass/react';

const steps = [
  { title: 'Order placed', time: 'Nov 18, 14:02' },
  { title: 'Payment confirmed', time: 'Nov 18, 14:05' },
  { title: 'Preparing', description: 'Due to leave the warehouse this afternoon.' },
  { title: 'Shipping' },
  { title: 'Delivered', description: 'Expected Sat, Nov 22' },
];

export default function Example() {
  const [at, setAt] = useState(2);
  return (
    <>
      {/* steps before `at` are done, `at` is current (aria-current="step"), the rest upcoming */}
      <Timeline aria-label="Order progress">
        {steps.map((s, i) => (
          <TimelineItem key={s.title} status={i < at ? 'done' : i === at ? 'current' : 'upcoming'}
            title={s.title} time={s.time} description={s.description} />
        ))}
      </Timeline>
      <Button size="sm" variant="tinted" disabled={at === steps.length - 1} onClick={() => setAt(at + 1)}>
        Next step
      </Button>
    </>
  );
}
