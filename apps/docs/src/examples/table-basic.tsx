import { DataTable, type Column } from '@satin-glass/react';

type Product = { id: string; name: string; price: number; stock: number };

const rows: Product[] = [
  { id: 'p1', name: 'Linen overshirt', price: 59000, stock: 12 },
  { id: 'p2', name: 'Cotton T-shirt', price: 19000, stock: 140 },
  { id: 'p3', name: 'Ceramic mugs, set of 2', price: 24000, stock: 0 },
];

const columns: Column<Product>[] = [
  { key: 'name', header: 'Product', width: 200, sortable: true },
  { key: 'price', header: 'Price', align: 'end', sortable: true, render: (p) => `₩${p.price.toLocaleString()}` },
  { key: 'stock', header: 'Stock', align: 'end', sortable: true, firstSort: 'desc' },
];

export default function Example() {
  return <DataTable aria-label="Products" rows={rows} columns={columns} rowKey={(p) => p.id} />;
}
