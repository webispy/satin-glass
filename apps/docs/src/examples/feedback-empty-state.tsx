import { useState } from 'react';
import { Button, EmptyState, SearchField, Stack, Tag, Text } from '@satin-glass/react';
import { PackageSearch } from 'lucide-react';

const products = [
  { name: 'Linen overshirt', stock: 12 },
  { name: 'Cotton T-shirt', stock: 0 },
  { name: 'Wool knit cardigan', stock: 4 },
];

export default function Example() {
  const [query, setQuery] = useState('linen shirt');
  const found = products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Stack gap={3}>
      <SearchField aria-label="Find a product" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      {found.length ? found.map((p) => (
        <Stack key={p.name} direction="row" gap={2} align="center">
          <Text>{p.name}</Text>
          {/* a tag is a status to read, not a control: its words carry the meaning */}
          {p.stock ? <Tag tone="success">In stock</Tag> : <Tag tone="warning">Sold out</Tag>}
        </Stack>
      )) : (
        <EmptyState size="sm" icon={<PackageSearch />} title={`No products match ‘${query}’`}
          description="Check the spelling or try another name."
          actions={<Button size="sm" variant="plain" onClick={() => setQuery('')}>Clear search</Button>} />
      )}
    </Stack>
  );
}
