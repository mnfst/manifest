import { createResource, createSignal, Show, type JSX } from 'solid-js';
import {
  getMessageDetails,
  flagMessageMiscategorized,
  clearMessageMiscategorized,
} from '../services/api.js';
import { inferProviderName } from '../services/routing-utils.js';
import { getModelDisplayName } from '../services/model-display.js';
import { ModelParamsSection, RequestHeadersSection } from './MessageDetailsSections.jsx';

export interface MessageDetailsProps {
  messageId: string;
}

function MetaField(props: { label: string; value: string | null | undefined }): JSX.Element {
  return (
    <Show when={props.value}>
      <span class="msg-detail__meta-item">
        <span class="msg-detail__meta-label">{props.label}</span>
        {props.value}
      </span>
    </Show>
  );
}

function MiscategorizeControl(props: {
  messageId: string;
  initiallyFlagged: boolean;
}): JSX.Element {
  const [flagged, setFlagged] = createSignal(props.initiallyFlagged);
  const [busy, setBusy] = createSignal(false);

  async function toggle() {
    // Belt-and-suspenders: `disabled={busy()}` on the button already rejects
    // real clicks during an in-flight request. This guard catches the narrow
    // race where Solid's event delegation could fire the handler before the
    // disabled attribute commits, and tests can't reliably reproduce it.
    /* v8 ignore next */
    if (busy()) return;
    setBusy(true);
    try {
      if (flagged()) {
        await clearMessageMiscategorized(props.messageId);
        setFlagged(false);
      } else {
        await flagMessageMiscategorized(props.messageId);
        setFlagged(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      class="msg-detail__miscat-btn"
      onClick={toggle}
      disabled={busy()}
      title="Flag this message's routing category as wrong. Repeated flags reduce this category's routing score for this harness."
      aria-pressed={flagged()}
    >
      {flagged() ? 'Flagged as miscategorized (undo)' : 'Wrong category?'}
    </button>
  );
}

export default function MessageDetails(props: MessageDetailsProps): JSX.Element {
  const [data] = createResource(() => props.messageId, getMessageDetails);

  return (
    <div class="msg-detail">
      <Show when={data.loading && !data.error}>
        <div class="msg-detail__loader">
          <div class="msg-detail__spinner" />
          <span>Loading details...</span>
        </div>
      </Show>
      <Show when={data.error}>
        <div class="msg-detail__error">Failed to load details</div>
      </Show>
      <Show when={!data.error && data() && !data.loading}>
        {(() => {
          const d = data()!;
          const m = d.message;
          const provider = m.model ? inferProviderName(m.model) : null;
          return (
            <>
              <Show when={m.error_message}>
                <div class="msg-detail__section">
                  <div class="msg-detail__section-title">Error</div>
                  <div class="msg-detail__error-box">{m.error_message}</div>
                </div>
              </Show>

              <Show when={m.fallback_from_model}>
                <div class="msg-detail__fallback-banner">
                  Fallback from <strong>{m.fallback_from_model}</strong>
                  <Show when={m.fallback_index != null}>
                    {' '}
                    {/* Show guard above ensures fallback_index is non-null here. */}
                    (attempt #{(m.fallback_index as number) + 1})
                  </Show>
                </div>
              </Show>

              <div class="msg-detail__section">
                <div class="msg-detail__section-title">Message</div>
                <div class="msg-detail__meta">
                  <span class="msg-detail__meta-item">
                    <span class="msg-detail__meta-label">Status</span>
                    <span class={`status-badge status-badge--${m.status}`}>{m.status}</span>
                  </span>
                  <MetaField label="ID" value={m.id} />
                  <MetaField label="Provider" value={provider} />
                  <MetaField label="Auth" value={m.auth_type} />
                  <MetaField label="API Key" value={m.provider_key_label ?? 'Default'} />
                  <MetaField label="Model" value={m.model ? getModelDisplayName(m.model) : null} />
                  <MetaField label="Model ID" value={m.model} />
                  <MetaField label="Trace" value={m.trace_id?.slice(0, 16)} />
                  <MetaField
                    label="Routing"
                    value={
                      m.header_tier_name ??
                      (m.specificity_category
                        ? m.specificity_category.replace(/_/g, ' ')
                        : m.routing_tier)
                    }
                  />
                  <Show when={m.specificity_category}>
                    <MiscategorizeControl
                      messageId={m.id}
                      initiallyFlagged={m.specificity_miscategorized}
                    />
                  </Show>
                  <MetaField label="Reason" value={m.routing_reason} />
                  <MetaField label="Service" value={m.service_type} />
                  <MetaField label="Session" value={m.session_key} />
                  <MetaField label="Description" value={m.description} />
                  <MetaField label="App" value={m.caller_attribution?.appName} />
                  <MetaField label="SDK" value={m.caller_attribution?.sdk} />
                  <MetaField label="Skill" value={m.skill_name} />
                </div>
              </div>

              {/* Model Parameters renders above Request Headers — params
                  are user intent (what the request asked for); headers are
                  protocol noise. The natural top-down reading order in a
                  routing-analytics context is intent → wire → response. */}
              <Show when={m.request_params && Object.keys(m.request_params).length > 0}>
                <ModelParamsSection params={m.request_params!} />
              </Show>

              <Show when={m.request_headers && Object.keys(m.request_headers).length > 0}>
                <RequestHeadersSection headers={m.request_headers!} />
              </Show>
            </>
          );
        })()}
      </Show>
    </div>
  );
}
