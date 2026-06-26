import { type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';
import type { ModelAlias } from '../services/api.js';
import { exposedSetupModels } from '../services/exposed-models.js';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
  modelAliases?: ModelAlias[];
}

export function getPiModelsJson(
  baseUrl: string,
  apiKey: string,
  modelAliases?: ModelAlias[],
): string {
  return JSON.stringify(
    {
      providers: {
        manifest: {
          name: 'Manifest',
          baseUrl,
          api: 'openai-completions',
          apiKey,
          models: exposedSetupModels(modelAliases).map((model) => ({
            id: model.id,
            name: model.name,
          })),
        },
      },
    },
    null,
    2,
  );
}

const PiSetup: Component<Props> = (props) => {
  const placeholderKey = 'mnfst_YOUR_KEY';
  const shownKey = () =>
    props.apiKey ?? (props.keyPrefix ? `${props.keyPrefix}...` : placeholderKey);
  const copyKey = () => props.apiKey ?? placeholderKey;
  const settingsCopy = () => getPiModelsJson(props.baseUrl, copyKey(), props.modelAliases);
  const settingsShown = () => getPiModelsJson(props.baseUrl, shownKey(), props.modelAliases);

  return (
    <div class="setup-agents-card">
      <p class="setup-method__hint">
        Add this block to <code class="setup-model-hint__code">~/.pi/agent/models.json</code>.
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

export default PiSetup;
