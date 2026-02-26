import { createSignal, createResource, For, Show, type Component } from "solid-js";
import { useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { isLocalMode } from "../services/local-mode.js";
import ProviderBanner from "../components/ProviderBanner.js";
import EmailProviderSetup from "../components/EmailProviderSetup.js";
import LimitRuleModal from "../components/LimitRuleModal.js";
import { toast } from "../services/toast-store.js";
import {
  getNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  getEmailProvider,
  removeEmailProvider,
  getRoutingStatus,
  type NotificationRule,
} from "../services/api.js";

function formatThreshold(rule: NotificationRule): string {
  if (rule.metric_type === "cost") return `$${Number(rule.threshold).toFixed(2)}`;
  return Number(rule.threshold).toLocaleString();
}

const PERIOD_LABELS: Record<string, string> = {
  hour: "Per hour",
  day: "Per day",
  week: "Per week",
  month: "Per month",
};

const Limits: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [rules, { refetch: refetchRules }] = createResource(
    () => agentName(),
    (name) => getNotificationRules(name),
  );
  const [emailProvider, { refetch: refetchProvider }] = createResource(getEmailProvider);
  const [routingStatus] = createResource(getRoutingStatus);
  const [showModal, setShowModal] = createSignal(false);

  const routingEnabled = () => routingStatus()?.enabled ?? false;

  const handleCreate = async (data: { metric_type: string; threshold: number; period: string; action: string }) => {
    try {
      await createNotificationRule({ agent_name: agentName(), ...data });
      await refetchRules();
      setShowModal(false);
      toast.success("Rule created");
    } catch {
      // error toast from fetchMutate
    }
  };

  const handleToggle = async (rule: NotificationRule) => {
    const active = isActive(rule);
    try {
      await updateNotificationRule(rule.id, { is_active: !active });
      await refetchRules();
    } catch {
      // error toast from fetchMutate
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotificationRule(id);
      await refetchRules();
      toast.success("Rule deleted");
    } catch {
      // error toast from fetchMutate
    }
  };

  const handleRemoveProvider = async () => {
    try {
      await removeEmailProvider();
      await refetchProvider();
      toast.success("Email provider removed");
    } catch {
      // error toast from fetchMutate
    }
  };

  const isActive = (rule: NotificationRule) =>
    typeof rule.is_active === "number" ? !!rule.is_active : rule.is_active;

  const blockRulesExceeded = () => {
    const r = rules();
    if (!r) return false;
    return r.some((rule) => rule.action === "block" && isActive(rule) && Number(rule.trigger_count) > 0);
  };

  return (
    <div class="container--md">
      <Title>{agentName()} - Limits | Manifest</Title>
      <Meta name="description" content={`Configure limits and alerts for ${agentName()}.`} />

      <div class="page-header">
        <div>
          <h1>Limits</h1>
          <span class="breadcrumb">{agentName()} &rsaquo; Alerts &amp; hard limits</span>
        </div>
        <button class="btn btn--primary btn--sm" onClick={() => setShowModal(true)}>
          + Create rule
        </button>
      </div>

      <Show when={blockRulesExceeded()}>
        <div class="limits-warning-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>One or more hard limits have been triggered. Proxy requests for this agent may be blocked.</span>
        </div>
      </Show>

      <Show when={!routingEnabled() && !isLocalMode()}>
        <div class="limits-routing-cta">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Enable routing to set hard limits</strong>
            <p>Hard limits block proxy requests when consumption exceeds a threshold. You can still use email alerts without routing.</p>
          </div>
        </div>
      </Show>

      <Show when={!isLocalMode()}>
        <div class="panel" style="margin-bottom: var(--gap-lg);">
          <Show
            when={emailProvider()}
            fallback={<EmailProviderSetup onConfigured={refetchProvider} />}
          >
            <ProviderBanner
              config={emailProvider()!}
              onEdit={refetchProvider}
              onRemove={handleRemoveProvider}
            />
          </Show>
        </div>
      </Show>

      <div class="panel">
        <div class="panel__title">Rules</div>
        <Show
          when={(rules() ?? []).length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state__title">No rules yet</div>
              <p>Create a rule to get notified or block requests when limits are exceeded.</p>
            </div>
          }
        >
          <table class="notif-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Metric</th>
                <th>Threshold</th>
                <th>Period</th>
                <th>Triggered</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={rules()}>
                {(rule) => (
                  <tr classList={{ "notif-table__row--disabled": !isActive(rule) }}>
                    <td>
                      <span
                        class="limit-type-badge"
                        classList={{
                          "limit-type-badge--alert": (rule.action ?? "notify") === "notify",
                          "limit-type-badge--hard": rule.action === "block",
                        }}
                      >
                        <Show when={rule.action === "block"} fallback={
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                        }>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        </Show>
                        {rule.action === "block" ? "Limit" : "Alert"}
                      </span>
                    </td>
                    <td style="text-transform: capitalize;">{rule.metric_type}</td>
                    <td class="notif-table__mono">{formatThreshold(rule)}</td>
                    <td>{PERIOD_LABELS[rule.period] ?? rule.period}</td>
                    <td class="notif-table__mono">{rule.trigger_count ?? 0}</td>
                    <td>
                      <div class="notif-table__actions">
                        <label class="notification-toggle">
                          <input
                            type="checkbox"
                            checked={isActive(rule)}
                            onChange={() => handleToggle(rule)}
                          />
                          <span class="notification-toggle__slider" />
                        </label>
                        <button
                          class="btn btn--ghost btn--sm notification-rule__delete"
                          onClick={() => handleDelete(rule.id)}
                          aria-label="Delete rule"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>

      <LimitRuleModal
        open={showModal()}
        routingEnabled={routingEnabled()}
        onClose={() => setShowModal(false)}
        onSave={handleCreate}
      />
    </div>
  );
};

export default Limits;
