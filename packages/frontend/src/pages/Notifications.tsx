import { Meta, Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import EmailProviderModal from '../components/EmailProviderModal.jsx';
import EmailProviderSetup from '../components/EmailProviderSetup.jsx';
import ErrorState from '../components/ErrorState.jsx';
import NotificationRuleModal from '../components/NotificationRuleModal.jsx';
import ProviderBanner from '../components/ProviderBanner.jsx';
import {
  deleteNotificationRule,
  getEmailProvider,
  getNotificationRules,
  removeEmailProvider,
  updateNotificationRule,
  type NotificationRule,
} from '../services/api.js';
import { formatMetricType } from '../services/formatters.js';
import { toast } from '../services/toast-store.js';

function formatThreshold(rule: NotificationRule): string {
  if (rule.metric_type === 'cost') return `$${Number(rule.threshold).toFixed(2)}`;
  return Number(rule.threshold).toLocaleString();
}

function periodLabel(period: string): string {
  const map: Record<string, string> = {
    hour: 'Per hour',
    day: 'Per day',
    week: 'Per week',
    month: 'Per month',
  };
  return map[period] ?? period;
}

const Notifications: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);
  const [modalOpen, setModalOpen] = createSignal(false);
  const [editingRule, setEditingRule] = createSignal<NotificationRule | null>(null);
  const [editProviderOpen, setEditProviderOpen] = createSignal(false);

  const [emailProvider, { refetch: refetchProvider }] = createResource(
    () => true,
    () => getEmailProvider(),
  );

  const [rules, { refetch }] = createResource(
    () => agentName(),
    (name) => getNotificationRules(name),
  );

  const hasProvider = () => !!emailProvider();
  const hasRules = () => !!rules()?.length;

  const openCreate = () => {
    setEditingRule(null);
    setModalOpen(true);
  };

  const openEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  const handleToggle = async (rule: NotificationRule) => {
    try {
      const newActive = rule.is_active ? false : true;
      await updateNotificationRule(rule.id, { is_active: newActive });
      toast.success(`Rule ${newActive ? 'enabled' : 'disabled'}`);
      refetch();
    } catch {
      // error toast already shown by fetchMutate
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteNotificationRule(ruleId);
      toast.success('Rule deleted');
      refetch();
    } catch {
      // error toast already shown by fetchMutate
    }
  };

  const handleRemoveProvider = async () => {
    try {
      await removeEmailProvider();
      toast.success('Email provider removed');
      refetchProvider();
    } catch {
      // error toast already shown by fetchMutate
    }
  };

  return (
    <div class="container--sm">
      <Title>{agentName()} - Notifications | Manifest</Title>
      <Meta
        name="description"
        content={`Set up alerts when ${agentName()} exceeds usage or cost limits.`}
      />

      <div class="page-header">
        <div>
          <h1>Notifications</h1>
          <span class="breadcrumb">
            {agentName()} &rsaquo; Manage your alerts and email provider
          </span>
        </div>
        <Show when={hasProvider()}>
          <button class="btn btn--primary" onClick={openCreate}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create alert
          </button>
        </Show>
      </div>

      <Show when={!emailProvider.loading}>
        {/* Provider section */}
        <Show when={hasProvider()} fallback={<EmailProviderSetup onConfigured={refetchProvider} />}>
          <ProviderBanner
            config={emailProvider()!}
            onEdit={() => setEditProviderOpen(true)}
            onRemove={handleRemoveProvider}
          />

          <EmailProviderModal
            open={editProviderOpen()}
            initialProvider={emailProvider()?.provider ?? 'resend'}
            editMode={true}
            existingKeyPrefix={emailProvider()?.keyPrefix}
            existingDomain={emailProvider()?.domain}
            existingNotificationEmail={emailProvider()?.notificationEmail}
            onClose={() => setEditProviderOpen(false)}
            onSaved={refetchProvider}
          />
        </Show>

        {/* Rules section */}
        <Show when={!rules.loading}>
          <Show when={!rules.error} fallback={<ErrorState error={rules.error} onRetry={refetch} />}>
            <Show
              when={hasRules()}
              fallback={
                <Show when={hasProvider()}>
                  <div class="empty-state">
                    <div class="empty-state__title">No alerts configured</div>
                    <p>
                      Create your first alert to get notified when token usage or costs exceed your
                      limits.
                    </p>
                    <button
                      class="btn btn--primary"
                      style="margin-top: var(--gap-md);"
                      onClick={openCreate}
                    >
                      Create alert
                    </button>
                  </div>
                </Show>
              }
            >
              {/* Warning when rules exist but no provider */}
              <Show when={!hasProvider()}>
                <div class="notif-hint">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p>
                    You must configure a valid email provider for your alerts to be delivered. The
                    rules below are currently inactive.
                  </p>
                </div>
              </Show>

              <div class="settings-card" classList={{ 'settings-card--disabled': !hasProvider() }}>
                <table class="notif-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Threshold</th>
                      <th>Period</th>
                      <th>Triggered</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <For each={rules()}>
                      {(rule) => (
                        <tr
                          class={
                            rule.is_active && hasProvider() ? '' : 'notif-table__row--disabled'
                          }
                        >
                          <td>{formatMetricType(rule.metric_type)}</td>
                          <td class="notif-table__mono">{formatThreshold(rule)}</td>
                          <td>{periodLabel(rule.period)}</td>
                          <td class="notif-table__mono">{Number(rule.trigger_count) || 0}</td>
                          <td class="notif-table__actions">
                            <button
                              class="btn btn--ghost notification-rule__edit"
                              onClick={() => openEdit(rule)}
                              aria-label="Edit rule"
                            >
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <label class="notification-toggle">
                              <input
                                type="checkbox"
                                checked={!!rule.is_active}
                                onChange={() => handleToggle(rule)}
                              />
                              <span class="notification-toggle__slider" />
                            </label>
                            <button
                              class="btn btn--ghost notification-rule__delete"
                              onClick={() => handleDelete(rule.id)}
                              aria-label="Delete rule"
                            >
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>

      <NotificationRuleModal
        open={modalOpen()}
        agentName={agentName()}
        rule={editingRule()}
        onClose={() => setModalOpen(false)}
        onSaved={() => refetch()}
      />
    </div>
  );
};

export default Notifications;
