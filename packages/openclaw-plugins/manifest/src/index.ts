import { PluginLogger } from './types';
import { registerLocalMode } from './local-mode';

/* eslint-disable @typescript-eslint/no-explicit-any */
module.exports = {
  id: 'manifest',
  name: 'Manifest Self-Hosted LLM Router',

  register(api: any) {
    const logger: PluginLogger = api.logger || {
      info: (...args: unknown[]) => console.log(...args),
      debug: () => {},
      error: (...args: unknown[]) => console.error(...args),
      warn: (...args: unknown[]) => console.warn(...args),
    };

    const config = api.pluginConfig || {};
    const inner =
      config && typeof config === 'object' && 'config' in config && config.config != null && typeof config.config === 'object'
        ? (config.config as Record<string, unknown>)
        : (config as Record<string, unknown>);

    const port = typeof inner.port === 'number' && inner.port > 0 ? inner.port : 2099;
    const host = typeof inner.host === 'string' && inner.host.length > 0 ? inner.host : '127.0.0.1';

    logger.info(
      `[manifest] 🦚 Dashboard: http://${host}:${port}\n` +
        '[manifest] 🦚 The plugin starts an embedded server.\n' +
        '[manifest] 🦚 Open the dashboard to connect a provider and start routing.',
    );

    registerLocalMode(api, port, host, logger);
  },
};
