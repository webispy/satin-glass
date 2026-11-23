import { Accordion, Text } from '@satin-glass/react';

const answer = (text: string) => <Text variant="subhead" tone="secondary" as="p">{text}</Text>;

export default function Example() {
  return (
    <Accordion
      multiple={false}
      level={4}
      defaultValue={['delivery']}
      items={[
        { value: 'delivery', title: 'Delivery', meta: 'Order by 2 p.m.', content: answer('Orders paid by 2 p.m. ship the same day.') },
        { value: 'returns', title: 'Exchanges and returns', content: answer('Request one within 7 days of delivery.') },
        { value: 'gift', title: 'Gift wrapping', meta: '₩2,000', content: answer('Choose it at checkout. A message card is free.') },
        { value: 'bulk', title: 'Bulk orders', disabled: true, content: null },
      ]}
    />
  );
}
