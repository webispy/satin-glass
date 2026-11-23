import { useState } from 'react';
import { ColumnChooser, DataTable, type Column } from '@satin-glass/react';

type Row = { id: string; name: string; sold: number; revenue: number; stock: number };

const rows: Row[] = [
  { id: 'a', name: 'Linen overshirt', sold: 81, revenue: 4779000, stock: 12 },
  { id: 'b', name: 'Cotton T-shirt', sold: 240, revenue: 4560000, stock: 140 },
];

/* columns with the same `group` share a header; the chooser lists them in the same groups */
const columns: Column<Row>[] = [
  { key: 'name', header: 'Product', width: 180, sticky: true },
  { key: 'sold', header: 'Units', group: 'Sales', align: 'end' },
  { key: 'revenue', header: 'Revenue', group: 'Sales', align: 'end', render: (r) => r.revenue.toLocaleString() },
  { key: 'stock', header: 'In stock', group: 'Stock', align: 'end' },
];

export default function Example() {
  const [hidden, setHidden] = useState<string[]>([]);
  return (
    <>
      <ColumnChooser columns={columns} hidden={hidden} onHiddenChange={setHidden} />
      <DataTable aria-label="Sales and stock" rows={rows} columns={columns} rowKey={(r) => r.id}
        hiddenColumns={hidden} columnLines="groups" />
    </>
  );
}
