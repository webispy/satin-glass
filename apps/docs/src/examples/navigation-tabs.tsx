import { useState } from 'react';
import { Tabs, Text } from '@satin-glass/react';
import { MessageSquare, Package, ShoppingBag } from 'lucide-react';

export default function Example() {
  const [tab, setTab] = useState('orders');
  return (
    /* variant="pill" wraps onto more lines instead of scrolling */
    <Tabs aria-label="Store admin" value={tab} onChange={setTab} items={[
      { value: 'orders', label: 'Orders', icon: <ShoppingBag />, badge: 12, content: <Text>12 new orders are waiting.</Text> },
      { value: 'products', label: 'Products', icon: <Package />, content: <Text>22 products listed, 2 hidden.</Text> },
      { value: 'reviews', label: 'Reviews', icon: <MessageSquare />, content: <Text>48 reviews this week.</Text> },
      { value: 'payouts', label: 'Payouts', disabled: true },
    ]} />
  );
}
