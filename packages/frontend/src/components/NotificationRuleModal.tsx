import { createSignal, createEffect, Show, type Component } from "solid-js";
import {
  createNotificationRule,
  updateNotificationRule,
  type NotificationRule,
} from "../services/api.js";
import { toast } from "../services/toast-store.js";

interface Props {
  open: boolean;
  agentName: string;
  rule?: NotificationRule | null;
  onClose: () => void;
  onSaved: () => void;
}

const NotificationRuleModal: Component<Props> = (props) => {
  const [metricType, setMetricType] = createSignal("tokens");
  const [threshold, setThreshold] = createSignal("");
  const [period, setPeriod] = createSignal("day");
  const [saving, setSaving] = createSignal(false);

  const isEdit = () => !!props.rule;

  createEffect(() => {
    if (props.open && props.rule) {
      setMetricType(props.rule.metric_type);
      setThreshold(String(props.rule.threshold));
      setPeriod(props.rule.period);
    } else if (props.open) {
      setMetricType("tokens");
      setThreshold("");
      setPeriod("day");
    }
  });

  const handleSave = async () => {
    const val = Number(threshold());
    if (isNaN(val) || val <= 0) return;

    setSaving(true);
    try {
      if (isEdit()) {
        await updateNotificationRule(props.rule!.id, {
          metric_type: metricType(),
          threshold: val,
          period: period(),
        });
        toast.success("Rule updated");
      } else {
        await createNotificationRule({
          agent_name: props.agentName,
          metric_type: metricType(),
          threshold: val,
          period: period(),
        });
        toast.success("Rule created");
      }
      props.onSaved();
      props.onClose();
    } catch {
      // error toast already shown by fetchMutate
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") props.onClose();
  };

  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={() => props.onClose()}>
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rule-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="rule-modal-title">
            {isEdit() ? "Edit alert" : "Create alert"}
          </h2>
          <p class="modal-card__desc">
            {isEdit()
              ? "Update when you want to be notified."
              : "Get notified when this agent uses more than a set amount of tokens or dollars."}
          </p>

          <label class="modal-card__field-label">Alert me about</label>
          <select
            class="select notification-modal__select"
            value={metricType()}
            onChange={(e) => setMetricType(e.currentTarget.value)}
          >
            <option value="tokens">Token usage</option>
            <option value="cost">Cost (USD)</option>
          </select>

          <label class="modal-card__field-label">Threshold</label>
          <input
            class="modal-card__input"
            type="number"
            min="0"
            step={metricType() === "cost" ? "0.01" : "1"}
            placeholder={metricType() === "cost" ? "e.g. 5.00" : "e.g. 50,000"}
            value={threshold()}
            onInput={(e) => setThreshold(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autofocus
          />

          <p class="modal-card__field-hint">
            {metricType() === "cost"
              ? "Set a dollar amount. You'll be notified when costs exceed this."
              : "A typical conversation uses 1,000\u20135,000 tokens."}
          </p>

          <label class="modal-card__field-label">Check every</label>
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

          <div class="modal-card__footer">
            <button
              class="btn btn--primary"
              onClick={handleSave}
              disabled={saving() || !threshold() || Number(threshold()) <= 0}
            >
              {saving() ? "Saving..." : isEdit() ? "Save changes" : "Create alert"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default NotificationRuleModal;
