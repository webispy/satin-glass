/* @satin-glass/a2ui: A2UI agent surfaces (protocol v1.0 and v0.9.1, the basic catalog) drawn with Satin Glass
   controls. web_core owns the protocol; this package draws it. Experimental and unpublished until both versions'
   conformance fixtures pass (#62). */
export { useA2ui, type A2uiOptions, type A2uiSession, type A2uiReport, type OutboundEnvelope } from './session';
export { A2uiSurfaces, A2uiSurface, A2uiProvider } from './surfaces';
export { satinCatalogs, BASIC_CATALOG_IDS, type SatinCatalogOptions } from './catalogs';
export { defaultAllowUrl, type AllowUrl, type UrlUse } from './urls';
export type { A2uiWords } from './words';
export type { Diagnostic, Ground } from './components/shared';
export type { Version } from './functions';
