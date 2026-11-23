import { Card, CardBody, CardHeader, Stack, Text } from '@satin-glass/react';

export default function Example() {
  return (
    <Stack direction="row" gap={4} align="flex-start" wrap>
      {/* interactive: the whole card is one button */}
      <Card interactive style={{ width: 240 }} onClick={() => { /* open the place */ }}>
        <CardBody>
          <Text variant="headline">Sunset Hill</Text>
          <Text variant="subhead" tone="secondary">2.4 km · sunset 6:42 p.m. today</Text>
        </CardBody>
      </Card>
      {/* outlined: a hairline border instead of a shadow */}
      <Card variant="outlined" style={{ width: 240 }}>
        <CardHeader title="Visits" description="Last 7 days" />
        <CardBody><Text variant="title-2">12,480</Text></CardBody>
      </Card>
    </Stack>
  );
}
