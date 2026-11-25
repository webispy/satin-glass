/* A2UI experiment (#62): one recorded agent turn, written out in each protocol version's syntax.
   An agent drafts an alert and asks the user to finish it: a bound name field with checks, a choice of severity as
   chips, a slider (v1.0 adds `steps`), a checkbox, a date and time, a modal that explains a term, and a save button
   whose checks gate its action. One child is named in the first update and only sent later, as a streaming agent
   would. */
import { BASIC_CATALOG_IDS } from '@satin-glass/a2ui';

export type Version = '1.0' | '0.9';
export type Step = { at: number; message: Record<string, unknown> };
export type Copy = {
  title: string; intro: string; name: string; namePlaceholder: string; nameRequired: string; nameShort: string;
  volume: string; email: string; rulesButton: string; rulesTitle: string; rules: string; save: string; fix: string; scope: string;
  severity: string; low: string; high: string; critical: string; pause: string;
};

export const SURFACE = 'new_alert';

export function alertTurn(v: Version, c: Copy): Step[] {
  const one = v === '1.0';
  const path = (p: string) => (one ? { '@path': p } : { path: p });
  const call = (name: string, args: Record<string, unknown>) => (one ? { '@call': name, args } : { call: name, args });
  const checks = (list: { condition: unknown; message: string }[]) => ({ [one ? '@checks' : 'checks']: list });
  /* v1.0 ids follow UAX #31 (no hyphens); v0.9.1 allows them, and its own examples use them */
  const id = (s: string) => (one ? s : s.replace(/_/g, '-'));
  const wrap = (body: Record<string, unknown>) => ({ version: one ? '1.0' : 'v0.9', ...body });
  const name = path('/alert/name');
  const nameOk = call('and', { values: [call('required', { value: name }), call('length', { value: name, min: 3 })] });

  const components = [
    { id: 'root', component: 'Card', child: id('main') },
    { id: id('main'), component: 'Column', children: [id('head'), id('intro'), id('scope'), id('name_field'), id('severity'), id('volume'), id('email'), id('pause'), id('rules'), id('divider'), id('actions')] },
    { id: id('head'), component: 'Row', align: 'center', children: [id('bell'), id('title')] },
    { id: id('bell'), component: 'Icon', name: 'notifications' },
    one ? { id: id('title'), component: 'Text', text: `## ${c.title}` } : { id: id('title'), component: 'Text', text: c.title, variant: 'h2' },
    { id: id('intro'), component: 'Text', text: c.intro, variant: 'caption' },
    {
      id: id('name_field'), component: 'TextField', label: c.name, value: name, ...(one ? { placeholder: c.namePlaceholder } : {}),
      ...checks([
        { condition: call('required', { value: name }), message: c.nameRequired },
        { condition: call('length', { value: name, min: 3 }), message: c.nameShort },
      ]),
    },
    {
      id: id('severity'), component: 'ChoicePicker', label: c.severity, variant: 'mutuallyExclusive', displayStyle: 'chips', value: path('/alert/severity'),
      options: [{ label: c.low, value: 'low' }, { label: c.high, value: 'high' }, { label: c.critical, value: 'critical' }],
    },
    { id: id('pause'), component: 'DateTimeInput', label: c.pause, enableDate: true, enableTime: true, value: path('/alert/pause') },
    { id: id('volume'), component: 'Slider', label: c.volume, min: 0, max: 100, value: path('/alert/volume'), ...(one ? { steps: 4 } : {}) },
    { id: id('email'), component: 'CheckBox', label: c.email, value: path('/alert/email') },
    { id: id('rules'), component: 'Modal', trigger: id('rules_button'), content: id('rules_body'), ...(one ? { '@accessibility': { label: c.rulesTitle } } : { accessibility: { label: c.rulesTitle } }) },
    { id: id('rules_button'), component: 'Button', variant: 'borderless', child: id('rules_button_text'), action: { event: { name: 'open_rules', context: {} } } },
    { id: id('rules_button_text'), component: 'Text', text: c.rulesButton },
    { id: id('rules_body'), component: 'Column', children: [id('rules_text')] },
    { id: id('rules_text'), component: 'Text', text: c.rules },
    { id: id('divider'), component: 'Divider' },
    { id: id('actions'), component: 'Row', justify: 'end', children: [id('save')] },
    {
      id: id('save'), component: 'Button', variant: 'primary', child: id('save_text'),
      ...checks([{ condition: nameOk, message: c.fix }]),
      action: { event: { name: 'save_alert', context: { name, severity: path('/alert/severity'), volume: path('/alert/volume'), email: path('/alert/email'), pause: path('/alert/pause') } } },
    },
    { id: id('save_text'), component: 'Text', text: c.save },
  ];

  return [
    { at: 0, message: wrap({ createSurface: { surfaceId: SURFACE, catalogId: BASIC_CATALOG_IDS[one ? '1.0' : '0.9'], sendDataModel: true } }) },
    { at: 0, message: wrap({ updateDataModel: { surfaceId: SURFACE, value: { alert: { name: '', severity: ['high'], volume: 50, email: true, pause: '' } } } }) },
    { at: 250, message: wrap({ updateComponents: { surfaceId: SURFACE, components } }) },
    /* the late child: named in `main` above, sent once the agent has looked it up */
    { at: 1600, message: wrap({ updateComponents: { surfaceId: SURFACE, components: [{ id: id('scope'), component: 'Text', text: c.scope, variant: 'caption' }] } }) },
  ];
}

export const deleteSurface = (v: Version) => ({ version: v === '1.0' ? '1.0' : 'v0.9', deleteSurface: { surfaceId: SURFACE } });
