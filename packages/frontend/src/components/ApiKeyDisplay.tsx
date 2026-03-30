import { Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
}

const ApiKeyDisplay: Component<Props> = (props) => {
  const hasFullKey = () => !!props.apiKey;

  return (
    <>
      <Show when={hasFullKey()}>
        <div class="api-key-display__value">
          {props.apiKey}
          <CopyButton text={props.apiKey!} />
        </div>
      </Show>

      <Show when={!hasFullKey() && props.keyPrefix}>
        <div class="api-key-display__prefix">
          Replace <code class="api-key-display__code">{props.keyPrefix}...</code> below with your
          full API key.
        </div>
      </Show>
    </>
  );
};

export default ApiKeyDisplay;
