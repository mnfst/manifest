import { createSignal, For, Show, type JSX } from 'solid-js';
import InfoTooltip from './InfoTooltip.jsx';

const MODEL_PARAMS_TOOLTIP =
  'Provider-specific request parameters that affected this call — e.g. ' +
  "DeepSeek's `thinking` toggle. The set is curated per provider today; " +
  'support for additional models and custom user-defined parameters lands ' +
  'here as it ships.';

/**
 * Render an effective model parameter value as a readable string. Objects
 * and arrays get pretty-printed with two-space indent so future provider
 * knobs (`reasoning_effort`, `safety: { mode: 'permissive' }`, etc.) wrap
 * naturally inside the value cell instead of becoming an unbreakable
 * single-line token. `undefined` matches the em-dash convention used
 * elsewhere in this panel for absent telemetry.
 */
export function formatParamValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export function RequestHeadersSection(props: { headers: Record<string, string> }): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const entries = (): Array<[string, string]> =>
    Object.entries(props.headers).sort(([a], [b]) => a.localeCompare(b));
  const tableId = `msg-detail-request-headers-${Math.random().toString(36).slice(2, 10)}`;
  return (
    <div class="msg-detail__section">
      <button
        type="button"
        class="msg-detail__section-title msg-detail__section-title--toggle"
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={tableId}
        onClick={() => setOpen((v) => !v)}
        style="font-size: 12px;"
      >
        Request Headers
        <span class="msg-detail__count-badge">{entries().length}</span>
        <span
          class="msg-detail__chevron"
          classList={{ 'msg-detail__chevron--open': open() }}
          aria-hidden="true"
        >
          &#9656;
        </span>
      </button>
      <Show when={open()}>
        <div class="data-table-scroll" id={tableId}>
          <table class="data-table msg-detail__table">
            <thead>
              <tr>
                <th>Header</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <For each={entries()}>
                {([k, v]) => (
                  <tr>
                    <td class="msg-detail__mono-xs">{k}</td>
                    <td class="msg-detail__mono-xs msg-detail__log-body">{v}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}

export function ModelParamsSection(props: { params: Record<string, unknown> }): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const entries = (): Array<[string, unknown]> =>
    Object.entries(props.params).sort(([a], [b]) => a.localeCompare(b));
  const tableId = `msg-detail-model-params-${Math.random().toString(36).slice(2, 10)}`;
  return (
    <div class="msg-detail__section">
      {/* Toggle button + InfoTooltip live as siblings inside a flex row.
          Putting the InfoTooltip *inside* the button would nest a focusable
          element in another (invalid HTML) and clicks would propagate
          through to toggle the accordion. */}
      <div class="msg-detail__section-row">
        <button
          type="button"
          class="msg-detail__section-title msg-detail__section-title--toggle msg-detail__section-title--inline"
          aria-expanded={open() ? 'true' : 'false'}
          aria-controls={tableId}
          onClick={() => setOpen((v) => !v)}
          style="font-size: 12px;"
        >
          Model Parameters
          <span class="msg-detail__count-badge">{entries().length}</span>
          <span
            class="msg-detail__chevron"
            classList={{ 'msg-detail__chevron--open': open() }}
            aria-hidden="true"
          >
            &#9656;
          </span>
        </button>
        <InfoTooltip text={MODEL_PARAMS_TOOLTIP} />
      </div>
      <Show when={open()}>
        <div class="data-table-scroll" id={tableId}>
          <table class="data-table msg-detail__table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <For each={entries()}>
                {([k, v]) => (
                  <tr>
                    <td class="msg-detail__mono-xs">{k}</td>
                    <td class="msg-detail__mono-xs msg-detail__param-value">
                      {formatParamValue(v)}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}
