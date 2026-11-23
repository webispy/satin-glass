import { useRef, useState } from 'react';
import { MediaViewer } from '@satin-glass/react';

/* any picture works: an image URL in `src`, or `render` for an SVG, a canvas or a video */
const photos = [
  { alt: 'Dawn', colors: ['#5b8def', '#ffd0b0'], width: 1600, height: 1040 },
  { alt: 'Dusk', colors: ['#ff8a5c', '#5c1d2e'], width: 1080, height: 1440 },
  { alt: 'Forest', colors: ['#3fbfa8', '#0b4a40'], width: 1200, height: 1200 },
];
const fill = (colors: string[]) => ({ width: '100%', height: '100%', background: `linear-gradient(${colors.join(', ')})` });

export default function Example() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        {photos.map((p, i) => (
          <button key={p.alt} ref={(el) => { thumbs.current[i] = el; }} type="button" aria-label={`View larger: ${p.alt}`}
            style={{ width: 88, height: 88, padding: 0, border: 0, borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in' }}
            onClick={() => { setIndex(i); setOpen(true); }}>
            <div style={fill(p.colors)} />
          </button>
        ))}
      </div>
      {/* getOrigin: the viewer grows out of the thumbnail and closes back into it */}
      <MediaViewer open={open} onClose={() => setOpen(false)} index={index} onIndexChange={setIndex}
        getOrigin={(i) => thumbs.current[i]} aria-label="Photo viewer"
        items={photos.map((p) => ({ alt: p.alt, caption: p.alt, width: p.width, height: p.height, render: () => <div style={fill(p.colors)} /> }))} />
    </>
  );
}
