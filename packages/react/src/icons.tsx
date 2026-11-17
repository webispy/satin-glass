/* The handful of glyphs the components draw themselves (own drawings: 24 grid, 2 px stroke, round caps).
   Apps bring their own icon set for everything else (e.g. lucide-react). */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P): P => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false, ...p });

export const CheckIcon = (p: P) => <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const ChevronRightIcon = (p: P) => <svg {...base(p)}><path d="M9.5 6l6 6-6 6" /></svg>;
export const ChevronDownIcon = (p: P) => <svg {...base(p)}><path d="M6 9.5l6 6 6-6" /></svg>;
export const ChevronLeftIcon = (p: P) => <svg {...base(p)}><path d="M14.5 6l-6 6 6 6" /></svg>;
export const CloseIcon = (p: P) => <svg {...base(p)}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>;
export const PlusIcon = (p: P) => <svg {...base(p)}><path d="M12 5.5v13M5.5 12h13" /></svg>;
export const MinusIcon = (p: P) => <svg {...base(p)}><path d="M5.5 12h13" /></svg>;
export const SearchIcon = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="6.25" /><path d="M15.6 15.6L19.5 19.5" /></svg>;
export const ClearIcon = (p: P) => (
  <svg {...base({ ...p, stroke: 'none' })}>
    <circle cx="12" cy="12" r="9" fill="currentColor" />
    <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" stroke="var(--gl-surface, #fff)" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
export const InfoIcon = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>;
export const AlertIcon = (p: P) => <svg {...base(p)}><path d="M12 4.5l8.5 15h-17z" /><path d="M12 10v4M12 17h.01" /></svg>;
export const SuccessIcon = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M8.3 12.3l2.6 2.6 4.8-5.2" /></svg>;
