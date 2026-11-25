/* The two basic catalogs (A2UI v1.0 and v0.9.1) drawn with Satin controls: one render function per component,
   registered against each version's own schema, with that version's own functions. */
import { createComponentImplementation } from '@a2ui/react';
import { Catalog } from '@a2ui/web_core';
import * as v1 from '@a2ui/web_core/catalogs/basic/v1';
import * as v09 from '@a2ui/web_core/v0_9/basic_catalog';
import { A2uiCard, A2uiDivider, A2uiList, A2uiModal, A2uiTabs, A2uiText, a2uiFlow } from './components/layout';
import { A2uiButton, A2uiCheckBox, A2uiChoicePicker, A2uiDateTimeInput, A2uiSlider, A2uiTextField } from './components/inputs';
import { A2uiAudioPlayer, A2uiIcon, A2uiImage, A2uiVideo } from './components/media';
import { catalogFunctions, type Version } from './functions';
import { defaultAllowUrl, type AllowUrl } from './urls';

/** the catalog IDs this package registers, by protocol version */
export const BASIC_CATALOG_IDS: Record<Version, string> = { '1.0': v1.basicCatalog.id, '0.9': v09.basicCatalog.id };

type Apis = typeof v1 | typeof v09;
const Row = a2uiFlow('row'), Column = a2uiFlow('column');
const components = (api: Apis) => [
  createComponentImplementation(api.TextApi, A2uiText),
  createComponentImplementation(api.ImageApi, A2uiImage),
  createComponentImplementation(api.IconApi, A2uiIcon),
  createComponentImplementation(api.VideoApi, A2uiVideo),
  createComponentImplementation(api.AudioPlayerApi, A2uiAudioPlayer),
  createComponentImplementation(api.RowApi, Row),
  createComponentImplementation(api.ColumnApi, Column),
  createComponentImplementation(api.ListApi, A2uiList),
  createComponentImplementation(api.CardApi, A2uiCard),
  createComponentImplementation(api.TabsApi, A2uiTabs),
  createComponentImplementation(api.ModalApi, A2uiModal),
  createComponentImplementation(api.DividerApi, A2uiDivider),
  createComponentImplementation(api.ButtonApi, A2uiButton),
  createComponentImplementation(api.TextFieldApi, A2uiTextField),
  createComponentImplementation(api.CheckBoxApi, A2uiCheckBox),
  createComponentImplementation(api.ChoicePickerApi, A2uiChoicePicker),
  createComponentImplementation(api.SliderApi, A2uiSlider),
  createComponentImplementation(api.DateTimeInputApi, A2uiDateTimeInput),
];
/* component implementations are made once per page: @a2ui/react registers a custom element for each, for good */
let made: Partial<Record<Version, ReturnType<typeof components>>> = {};
const componentsOf = (version: Version) => (made[version] ??= components(version === '1.0' ? v1 : v09));

export type SatinCatalogOptions = {
  /** the protocol versions to register; default both */
  versions?: Version[];
  /** read each time a formatting function runs; default 'en' */
  locale?: () => string;
  /** the app's URL policy for `openUrl`; default https and same-origin only (plus mailto: and tel:) */
  allowUrl?: () => AllowUrl;
  /** told of an agent's `regex` pattern that is not run (see patterns.ts) */
  onRefusedPattern?: (pattern: string) => void;
};

/** The basic catalogs drawn with Satin controls, for an app that owns its own `MessageProcessor`. Its surfaces must
    still be rendered inside `<A2uiSurfaces>` or `<A2uiSurface>`, which give the components their words and icons. */
export function satinCatalogs({ versions = ['1.0', '0.9'], locale = () => 'en', allowUrl = () => defaultAllowUrl, onRefusedPattern }: SatinCatalogOptions = {}) {
  return versions.map((v) => new Catalog(BASIC_CATALOG_IDS[v], v, componentsOf(v), catalogFunctions(v, { locale, allowUrl, refused: onRefusedPattern })));
}

/** for tests: forget the component implementations made so far */
export const resetForTests = () => { made = {}; };
