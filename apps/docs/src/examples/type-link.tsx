import { Link, Text } from '@satin-glass/react';

export default function Example() {
  return (
    <>
      <Text>
        Read the <Link href="#/a11y">accessibility guide</Link> before you ship.
      </Text>
      {/* external: an arrow, as the link leaves the app; target="_blank" also tells screen readers it opens in a new tab or window */}
      <Text variant="footnote" tone="secondary">
        Icons from <Link href="https://lucide.dev" external target="_blank" tone="inherit">Lucide</Link>, ISC License.
      </Text>
    </>
  );
}
