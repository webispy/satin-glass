/* a consumer of the session that React does not render again when its parent does */
import { memo } from 'react';
import { A2uiSurfaces, type A2uiSession } from '../src';
export const MemoSurfaces = memo(function MemoSurfaces({ a2ui }: { a2ui: A2uiSession }) { return <A2uiSurfaces a2ui={a2ui} />; });
