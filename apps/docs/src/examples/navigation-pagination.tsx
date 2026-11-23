import { useState } from 'react';
import { Pagination } from '@satin-glass/react';

export default function Example() {
  const [page, setPage] = useState(6);
  return (
    /* siblings: how many pages to show either side of the current one (1 by default).
       The buttons' names follow the theme's locale (English by default, Korean for ko); labels override them. */
    <Pagination page={page} pageCount={40} onChange={setPage} siblings={1}
      aria-label="Order pages" />
  );
}
