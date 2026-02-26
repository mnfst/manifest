import { createSignal, Show, type Component } from "solid-js";

interface Props {
  open: boolean;
  routingEnabled: boolean;
  onClose: () => void;
  onSave: (data: { metric_type: string; threshold: number; period: string; action: string }) => void;
}

const LimitRuleModal: Component<Props> = (props) => {
  const [action, setAction] = createSignal<string>("notify");
  const [metricType, setMetricType] = createSignal<string>("tokens");
  const [threshold, setThreshold] = createSignal<string>("");
  const [period, setPeriod] = createSignal<string>("day");

  const reset = () => {
    setAction("notify");
    setMetricType("tokens");
    setThreshold("");
    setPeriod("day");
  };

  const handleSave = () => {
    const val = Number(threshold());
    if (isNaN(val) || val <= 0) return;
    props.onSave({
      metric_type: metricType(),
      threshold: val,
      period: period(),
      action: action(),
    });
    reset();
  };

  const handleClose = () => {
    reset();
    props.onClose();
  };

  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={() => handleClose()}>
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="limit-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="limit-modal-title">Create rule</h2>
          <p class="modal-card__desc">
            Set up an alert or hard limit for this agent's usage.
          </p>

          <label class="modal-card__field-label" style="margin-top: 0;">Rule type</label>
          <div class="limit-type-selector">
            <button
              class="limit-type-option"
              classList={{ "limit-type-option--active": action() === "notify" }}
              onClick={() => setAction("notify")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              Alert
            </button>
            <button
              class="limit-type-option"
              classList={{
                "limit-type-option--active": action() === "block",
                "limit-type-option--disabled": !props.routingEnabled,
              }}
              disabled={!props.routingEnabled}
              onClick={() => props.routingEnabled && setAction("block")}
              title={props.routingEnabled ? undefined : "Enable routing to use hard limits"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Hard Limit
            </button>
          </div>

          <label class="modal-card__field-label">Metric</label>
          <select
            class="select notification-modal__select"
            value={metricType()}
            onChange={(e) => setMetricType(e.currentTarget.value)}
          >
            <option value="tokens">Tokens</option>
            <option value="cost">Cost (USD)</option>
          </select>

          <div class="limit-modal__row">
            <div class="limit-modal__col">
              <label class="modal-card__field-label">Threshold</label>
              <input
                class="modal-card__input"
                type="number"
                min="0"
                step={metricType() === "cost" ? "0.01" : "1"}
                placeholder={metricType() === "cost" ? "e.g. 10.00" : "e.g. 50000"}
                value={threshold()}
                onInput={(e) => setThreshold(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>
            <div class="limit-modal__col">
              <label class="modal-card__field-label">Period</label>
              <select
                class="select notification-modal__select"
                value={period()}
                onChange={(e) => setPeriod(e.currentTarget.value)}
              >
                <option value="hour">Per hour</option>
                <option value="day">Per day</option>
                <option value="week">Per week</option>
                <option value="month">Per month</option>
              </select>
            </div>
          </div>

          <div class="modal-card__footer">
            <button
              class="btn btn--primary"
              disabled={!threshold() || Number(threshold()) <= 0}
              onClick={handleSave}
            >
              Create rule
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default LimitRuleModal;
