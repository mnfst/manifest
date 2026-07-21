import type { LocalizedCatalog } from '../../catalog-types.js';
import en from '../en/index.js';
import { ruComponentsAM } from './components-a-m.js';
import { ruComponentsNZ } from './components-n-z.js';
import { ruFormatters } from './formatters.js';
import { ruI18n } from './i18n.js';
import { ruPages } from './pages.js';
import { ruShell } from './shell.js';
import { ruServices } from './services.js';
import { ruProviders } from './providers.js';

export { metadata } from './model-param-metadata.js';

const ru = {
  ...ruI18n,
  ...ruShell,
  ...ruFormatters,
  ...ruServices,
  ...ruProviders,
  ...ruPages,
  ...ruComponentsAM,
  ...ruComponentsNZ,
} as const satisfies LocalizedCatalog<typeof en>;

export default ru;
