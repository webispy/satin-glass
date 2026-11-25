import { screen } from '@testing-library/react';
import { components, create, mount, type V } from './helpers';

describe.each<V>(['1.0', '0.9'])('a surface in v%s', (v) => {
  it('draws Text, Column and Card with Satin', () => {
    const { feed, container } = mount();
    feed(create(v), components(v, [
      { id: 'root', component: 'Card', child: 'col' },
      { id: 'col', component: 'Column', children: ['a', 'b'] },
      { id: 'a', component: 'Text', text: 'Hello' },
      { id: 'b', component: 'Text', text: 'World', variant: 'caption' },
    ]));
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(container.querySelector('.sg-card')).toBeTruthy();
    expect(screen.getByText('World').className).toMatch(/sg-text/);
  });
});
