/* The glass classes for a variant and level. Internal: apps use <Glass as={…}>, which also takes the pointer light;
   not exported from any entry point (exports.test.ts holds the public list). */
import { cx } from './utils';
import type { GlassLevel, GlassVariant } from './foundation';

export function glassClass(variant: GlassVariant = 'regular', pressable?: boolean, level: GlassLevel = 'float') {
  return cx('sg-glass', variant !== 'regular' && `sg-glass--${variant}`, level === 'overlay' && 'sg-glass--overlay', pressable && 'sg-pressable');
}
