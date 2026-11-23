import { Stack, Stat } from '@satin-glass/react';
import { RotateCcw, ShoppingBag } from 'lucide-react';

/* spoken words for the direction of the change */
const labels = { up: 'Up', down: 'Down', flat: 'No change' };

export default function Example() {
  return (
    <Stack direction="row" gap={3} wrap>
      <Stat label="Orders" icon={<ShoppingBag />} value="1,284" delta="+12.4%" hint="vs last week"
        trend={[160, 172, 168, 181, 175, 190, 198]} labels={labels} />
      {/* a rise is bad here, so invert flips the colours */}
      <Stat label="Return rate" icon={<RotateCcw />} value="2.8%" delta="+0.4 pp" hint="vs last week" invert
        trend={[2.1, 2.3, 2.2, 2.5, 2.4, 2.6, 2.8]} labels={labels} />
    </Stack>
  );
}
