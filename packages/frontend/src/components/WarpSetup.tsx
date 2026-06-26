import { type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';
import type { ModelAlias } from '../services/api.js';
import { exposedSetupModels, type ExposedSetupModel } from '../services/exposed-models.js';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
  modelAliases?: ModelAlias[];
}

function warpSetupModels(modelAliases?: ModelAlias[]): ExposedSetupModel[] {
  const models = exposedSetupModels(modelAliases);
  const baseModels = models.filter((model) => model.id === 'auto' || model.id === 'manifest/auto');
  const aliasById = new Map(
    (modelAliases ?? [])
      .filter((alias) => alias.enabled)
      .map((alias) => [alias.model_id.toLowerCase(), alias]),
  );
  const aliasModels = models
    .filter((model) => model.id !== 'auto' && model.id !== 'manifest/auto')
    .sort((a, b) => {
      const aAlias = aliasById.get(a.id.toLowerCase());
      const bAlias = aliasById.get(b.id.toLowerCase());
      const aDirect = aAlias?.source_kind === 'direct' ? 0 : 1;
      const bDirect = bAlias?.source_kind === 'direct' ? 0 : 1;
      return aDirect - bDirect;
    });
  return [...baseModels, ...aliasModels];
}

export function getWarpCustomEndpointJson(
  baseUrl: string,
  apiKey: string,
  modelAliases?: ModelAlias[],
): string {
  return JSON.stringify(
    {
      name: 'Manifest',
      url: baseUrl,
      api_key: apiKey,
      models: warpSetupModels(modelAliases).map((model) => ({
        name: model.id,
        alias: model.name,
      })),
    },
    null,
    2,
  );
}

const WarpSetup: Component<Props> = (props) => {
  const placeholderKey = 'mnfst_YOUR_KEY';
  const shownKey = () =>
    props.apiKey ?? (props.keyPrefix ? `${props.keyPrefix}...` : placeholderKey);
  const copyKey = () => props.apiKey ?? placeholderKey;
  const settingsCopy = () =>
    getWarpCustomEndpointJson(props.baseUrl, copyKey(), props.modelAliases);
  const settingsShown = () =>
    getWarpCustomEndpointJson(props.baseUrl, shownKey(), props.modelAliases);

  return (
    <div class="setup-agents-card">
      <p class="setup-method__hint">
        Add a Warp custom inference endpoint named{' '}
        <code class="setup-model-hint__code">Manifest</code>. Warp creates the internal{' '}
        <code class="setup-model-hint__code">config_key</code> values for the model rows.
      </p>

      <div class="setup-cli-block">
        <div class="setup-cli-block__actions">
          <CopyButton text={settingsCopy()} />
        </div>
        <CodeBlock code={settingsShown()} language="json" />
      </div>
    </div>
  );
};

export default WarpSetup;
