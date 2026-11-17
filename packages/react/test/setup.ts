/* jsdom lacks a few browser APIs the components use */
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver ??= RO;
if (!window.matchMedia) window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as any;
const fakeAnim = () => ({ finished: Promise.resolve(), cancel() {}, finish() {}, onfinish: null });
if (!Element.prototype.animate) (Element.prototype as any).animate = fakeAnim;
if (!Element.prototype.getAnimations) (Element.prototype as any).getAnimations = () => [];
if (!Element.prototype.setPointerCapture) { (Element.prototype as any).setPointerCapture = () => {}; (Element.prototype as any).releasePointerCapture = () => {}; (Element.prototype as any).hasPointerCapture = () => false; }
