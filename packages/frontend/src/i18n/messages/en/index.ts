import { enComponentsAM } from './components-a-m.js';
import { enComponentsNZ } from './components-n-z.js';
import { enFormatters } from './formatters.js';
import { enI18n } from './i18n.js';
import { enPages } from './pages.js';
import { enShell } from './shell.js';
import { enServices } from './services.js';
import { enProviders } from './providers.js';

/**
 * The English catalog is the canonical schema and runtime fallback for every
 * locale. Feature catalogs stay separate so localization work can be split
 * without turning this file into a large copy-editing hotspot.
 */
const en = {
  ...enI18n,
  ...enShell,
  ...enFormatters,
  ...enServices,
  ...enProviders,
  ...enPages,
  ...enComponentsAM,
  ...enComponentsNZ,
} as const;

export default en;
