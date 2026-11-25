/* Where an agent's URLs may go. A URL is resolved once, against the document's base URL (as the browser will), and
   the exact absolute URL the policy approved is the one used. Media and posters pass web_core's sanitiser (http,
   https and data URLs), then the app's policy; `openUrl` passes the app's policy and needs a live user gesture. */
import { sanitizeMediaUrl } from '@a2ui/web_core';

export type UrlUse = 'image' | 'video' | 'audio' | 'poster' | 'open';
/** Return false to refuse a URL an agent asked for. */
export type AllowUrl = (url: URL, use: UrlUse) => boolean;

/** The default policy: https and same-origin URLs; for media also `data:` images, video and audio; for `openUrl` also
    `mailto:` and `tel:`. */
export const defaultAllowUrl: AllowUrl = (url, use) =>
  url.protocol === 'https:' || (typeof location !== 'undefined' && url.origin === location.origin)
  || (use === 'open' && (url.protocol === 'mailto:' || url.protocol === 'tel:'))
  || (use !== 'open' && url.protocol === 'data:' && /^data:(image|video|audio)\//.test(url.href));

const base = () => (typeof document !== 'undefined' ? document.baseURI : typeof location !== 'undefined' ? location.href : undefined);
const resolve = (raw: string) => { try { return new URL(raw, base()); } catch { return undefined; } };

/** the absolute URL to use, or undefined when it is refused */
export function mediaUrl(raw: unknown, use: Exclude<UrlUse, 'open'>, allow: AllowUrl): string | undefined {
  const clean = sanitizeMediaUrl(raw);
  const url = clean ? resolve(clean) : undefined;
  return url && ['http:', 'https:', 'data:'].includes(url.protocol) && allow(url, use) ? url.href : undefined;
}

/* the last trusted press of an A2UI button: a script's synthetic click is not one (event.isTrusted is false) */
let trustedAt = -Infinity;
const GESTURE_MS = 1000;
/** @internal called by the button component on a trusted click */
export const markTrustedGesture = () => { trustedAt = typeof performance !== 'undefined' ? performance.now() : Date.now(); };

/** opens the URL in a new tab if the policy allows it, the action came from a trusted press of an A2UI button less
    than a second ago, and (where the browser can tell) the user's gesture is still live; whether it did */
export function openUrl(raw: unknown, allow: AllowUrl): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - trustedAt > GESTURE_MS) return false;
  trustedAt = -Infinity;   // one press opens one URL
  const url = typeof raw === 'string' ? resolve(raw.trim()) : undefined;
  if (!url || !['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) || !allow(url, 'open')) return false;
  /* web_core marks every action call as user-activated, a script's synthetic click included; the browser knows
     whether a real gesture is still live (where it can tell) */
  const activation = typeof navigator !== 'undefined' ? (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation : undefined;
  if (activation && !activation.isActive) return false;
  if (typeof window !== 'undefined') window.open(url.href, '_blank', 'noopener,noreferrer');
  return true;
}
