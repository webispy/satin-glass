import { useState } from 'react';
import { Chip, FilterBar, SearchField, Select } from '@satin-glass/react';

export default function Example() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [inStock, setInStock] = useState(false);
  /* the app counts what applies; the bar shows the count and a Clear button */
  const count = (q ? 1 : 0) + (kind !== 'all' ? 1 : 0) + (inStock ? 1 : 0);
  return (
    <FilterBar aria-label="Product filters" count={count}
      onClear={() => { setQ(''); setKind('all'); setInStock(false); }}>
      <SearchField aria-label="Find a product" placeholder="Name" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
      <Select variant="filter" label="Category" value={kind} onChange={setKind}
        options={[{ value: 'all', label: 'All' }, { value: 'wear', label: 'Clothing' }, { value: 'home', label: 'Home' }]} />
      <Chip selected={inStock} onSelectedChange={setInStock}>In stock</Chip>
    </FilterBar>
  );
}
