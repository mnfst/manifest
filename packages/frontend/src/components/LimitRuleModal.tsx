import { createSignal, createEffect, Show, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import AlertIcon from "./AlertIcon.js";
import LimitIcon from "./LimitIcon.js";

export interface LimitRuleData {
  metric_type: string;
  threshold: number;
  period: string;
  action: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: LimitRuleData) => void;
  editData?: LimitRuleData | null;
  hasProvider?: boolean;
}

const LimitRuleModal: Component<Props> = (props) => {
  const [selectedTypes, setSelectedTypes] = createSignal<Set<string>>(new Set(["notify"]));
  const [metricType, setMetricType] = createSignal<string>("tokens");
  const [threshold, setThreshold] = createSignal<string>("");
  const [period, setPeriod] = createSignal<string>("day");

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const actionValue = () => {
    const s = selectedTypes();
    if (s.has("notify") && s.has("block")) return "both";
    if (s.has("block")) return "block";
    return "notify";
  };

  const reset = () => {
    setSelectedTypes(new Set(["notify"]));
    setMetricType("tokens");
    setThreshold("");
    setPeriod("day");
  };

  createEffect(() => {
    if (props.open && props.editData) {
      const d = props.editData;
      setMetricType(d.metric_type);
      setThreshold(String(d.threshold));
      setPeriod(d.period);
      const types = new Set<string>();
      if (d.action === "notify" || d.action === "both") types.add("notify");
      if (d.action === "block" || d.action === "both") types.add("block");
      setSelectedTypes(types);
    } else if (props.open) {
      reset();
    }
  });

  const handleSave = () => {
    const val = Number(threshold());
    if (isNaN(val) || val <= 0) return;
    props.onSave({
      metric_type: metricType(),
      threshold: val,
      period: period(),
      action: actionValue(),
    });
    reset();
  };

  const handleClose = () => {
    reset();
    props.onClose();
  };

  const isEdit = () => !!props.editData;

  return (
    <Portal>
    <Show when={props.open}>
      <div class="modal-overlay" onClick={() => handleClose()}>
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="limit-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="limit-modal-title">
            {isEdit() ? "Edit rule" : "Create rule"}
          </h2>
          <p class="modal-card__desc">
            Set up an email alert or hard limit for this agent's usage.
          </p>

          <label class="modal-card__field-label" style="margin-top: 0;">Rule type</label>
          <div class="limit-type-selector">
            <button
              class="limit-type-option"
              classList={{ "limit-type-option--active": selectedTypes().has("notify") }}
              onClick={() => toggleType("notify")}
            >
              <AlertIcon size={16} />
              <span class="limit-type-option__label">Email Alert</span>
              <Show when={selectedTypes().has("notify")}>
                <svg class="limit-type-option__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </Show>
            </button>
            <button
              class="limit-type-option"
              classList={{ "limit-type-option--active": selectedTypes().has("block") }}
              onClick={() => toggleType("block")}
            >
              <LimitIcon size={16} />
              <span class="limit-type-option__label">Hard Limit</span>
              <Show when={selectedTypes().has("block")}>
                <svg class="limit-type-option__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </Show>
            </button>
          </div>

          <Show when={selectedTypes().has("notify") && props.hasProvider === false}>
            <p class="limit-type-hint">
              Email alerts require an email provider. You can set one up once you're done creating your rule.
            </p>
          </Show>

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
              {isEdit() ? "Save changes" : "Create rule"}
            </button>
          </div>
        </div>
      </div>
    </Show>
    </Portal>
  );
};

export default LimitRuleModal;
