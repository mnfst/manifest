import { type Component, createResource } from 'solid-js';
import FrameworkSnippets from './FrameworkSnippets.jsx';
import { getAgentKey } from '../services/api.js';
import type { HeaderTier } from '../services/api/header-tiers.js';

interface Props {
  agentName: string;
  tier: HeaderTier;
  onClose: () => void;
}

/**
 * Modal that shows SDK-specific code snippets for sending the tier's matching
 * header. Reuses {@link FrameworkSnippets} (the same tabbed UI used in the
 * onboarding wizard) with `customHeaders` filled from the tier's rule.
 */
const HeaderTierSnippetModal: Component<Props> = (props) => {
  const [keyData] = createResource(
    () => props.agentName,
    (n) => getAgentKey(n),
  );

  const baseUrl = (): string => {
    const host = window.location.hostname;
    if (host === 'app.manifest.build') return 'https://app.manifest.build/v1';
    return `${window.location.origin}/v1`;
  };

  const customHeaders = (): Record<string, string> => ({
    [props.tier.header_key]: props.tier.header_value,
  });

  const modelText = (): string =>
    props.tier.override_model ?? 'no model assigned (falls back to default routing)';

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onClose();
      }}
    >
      <div
        class="modal-card"
        style="max-width: 720px;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="header-tier-snippet-title"
      >
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <h2
            id="header-tier-snippet-title"
            style="margin: 0; font-size: var(--font-size-lg); font-weight: 600;"
          >
            Send the “{props.tier.name}” header
          </h2>
          <button class="modal__close" onClick={() => props.onClose()} aria-label="Close">
            ×
          </button>
        </div>
        <p class="modal-card__desc" style="margin-top: 0;">
          Add this header to any request and it'll route to <code>{modelText()}</code>.
        </p>

        <FrameworkSnippets
          apiKey={keyData()?.apiKey ?? null}
          keyPrefix={keyData()?.keyPrefix ?? null}
          baseUrl={baseUrl()}
          customHeaders={customHeaders()}
        />

        <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
          <button class="btn btn--primary" type="button" onClick={() => props.onClose()}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default HeaderTierSnippetModal;
