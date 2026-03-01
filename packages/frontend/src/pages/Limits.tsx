import { createSignal, createResource, For, Show, onCleanup, type Component } from "solid-js";
import { useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { Portal } from "solid-js/web";
import { isLocalMode } from "../services/local-mode.js";
import { authClient } from "../services/auth-client.js";
import ProviderBanner from "../components/ProviderBanner.js";
import EmailProviderSetup from "../components/EmailProviderSetup.js";
import CloudEmailInfo from "../components/CloudEmailInfo.js";
import LimitRuleModal from "../components/LimitRuleModal.js";
import type { LimitRuleData } from "../components/LimitRuleModal.js";
import EmailProviderModal from "../components/EmailProviderModal.js";
import LimitIcon from "../components/LimitIcon.js";
import AlertIcon from "../components/AlertIcon.js";
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
  const session = authClient.useSession();
  const [showModal, setShowModal] = createSignal(false);
  const [showEditProvider, setShowEditProvider] = createSignal(false);
  const [editRule, setEditRule] = createSignal<NotificationRule | null>(null);
  const [openMenuId, setOpenMenuId] = createSignal<string | null>(null);
  const [menuPos, setMenuPos] = createSignal<{ top: number; left: number }>({ top: 0, left: 0 });
  const [deleteTarget, setDeleteTarget] = createSignal<NotificationRule | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = createSignal(false);

  const routingEnabled = () => routingStatus()?.enabled ?? false;
  const hasProvider = () => !isLocalMode() || !!emailProvider();

  const closeMenu = () => setOpenMenuId(null);
  const handleDocClick = () => closeMenu();

  const toggleMenu = (ruleId: string, e: MouseEvent) => {
    e.stopPropagation();
    if (openMenuId() === ruleId) {
      closeMenu();
    } else {
      const btn = e.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right });
      setOpenMenuId(ruleId);
      setTimeout(() => document.addEventListener("click", handleDocClick, { once: true }), 0);
    }
  };

  onCleanup(() => document.removeEventListener("click", handleDocClick));

  const handleCreate = async (data: LimitRuleData) => {
    try {
      await createNotificationRule({ agent_name: agentName(), ...data });
      await refetchRules();
      setShowModal(false);
      toast.success("Rule created");
    } catch {
      // error toast from fetchMutate
    }
  };

  const handleEdit = (rule: NotificationRule) => {
    closeMenu();
    setEditRule(rule);
    setShowModal(true);
  };

  const handleSave = async (data: LimitRuleData) => {
    const editing = editRule();
    try {
      if (editing) {
        await updateNotificationRule(editing.id, { ...data });
        toast.success("Rule updated");
      } else {
        await createNotificationRule({ agent_name: agentName(), ...data });
        toast.success("Rule created");
      }
      await refetchRules();
      setShowModal(false);
      setEditRule(null);
    } catch {
      // error toast from fetchMutate
    }
  };

  const openDeleteConfirm = (rule: NotificationRule) => {
    closeMenu();
    setDeleteTarget(rule);
    setDeleteConfirmed(false);
  };

  const handleDelete = async () => {
    const target = deleteTarget();
    if (!target) return;
    try {
      await deleteNotificationRule(target.id);
      await refetchRules();
      toast.success("Rule deleted");
    } catch {
      // error toast from fetchMutate
    }
    setDeleteTarget(null);
    setDeleteConfirmed(false);
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
    return r.some((rule) => (rule.action === "block" || rule.action === "both") && isActive(rule) && Number(rule.trigger_count) > 0);
  };

  const hasEmailAction = (action: string) => action === "notify" || action === "both";
  const hasBlockAction = (action: string) => action === "block" || action === "both";

  return (
    <div class="container--sm">
      <Title>{agentName()} Limits - Manifest</Title>
      <Meta name="description" content={`Configure limits and alerts for ${agentName()}.`} />

      <div class="page-header">
        <div>
          <h1>Limits</h1>
          <span class="breadcrumb">{agentName()} &rsaquo; Email alerts &amp; hard limits</span>
        </div>
        <button class="btn btn--primary btn--sm" onClick={() => { setEditRule(null); setShowModal(true); }}>
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

      <Show when={routingStatus() && !routingEnabled() && !isLocalMode()}>
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
        <div style="margin-bottom: var(--gap-lg);">
          <CloudEmailInfo email={session().data?.user?.email ?? ""} />
        </div>
      </Show>

      <Show when={isLocalMode()}>
        <div style="margin-bottom: var(--gap-lg);">
          <Show
            when={emailProvider()}
            fallback={<EmailProviderSetup onConfigured={refetchProvider} />}
          >
            <ProviderBanner
              config={emailProvider()!}
              onEdit={() => setShowEditProvider(true)}
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
              <p>Create a rule to receive email alerts or block requests when thresholds are exceeded.</p>
            </div>
          }
        >
          <table class="notif-table notif-table--flush">
            <thead>
              <tr>
                <th>Type</th>
                <th>Threshold</th>
                <th>Triggered</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={rules()}>
                {(rule) => (
                  <tr classList={{ "notif-table__row--disabled": !isActive(rule) }}>
                    <td>
                      <div class="limit-type-icons">
                        <Show when={hasEmailAction(rule.action ?? "notify")}>
                          <span class="limit-type-icon" title="Email Alert">
                            <AlertIcon size={14} />
                          </span>
                        </Show>
                        <Show when={hasBlockAction(rule.action ?? "notify")}>
                          <span class="limit-type-icon" title="Hard Limit">
                            <LimitIcon size={14} />
                          </span>
                        </Show>
                        <Show when={hasEmailAction(rule.action ?? "notify") && !hasProvider()}>
                          <span class="limit-warn-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            No provider
                          </span>
                        </Show>
                      </div>
                    </td>
                    <td>
                      <span class="notif-table__mono">{formatThreshold(rule)}</span>
                      {" "}
                      <span class="notif-table__period">{(PERIOD_LABELS[rule.period] ?? rule.period).toLowerCase()}</span>
                    </td>
                    <td class="notif-table__mono">{rule.trigger_count ?? 0}</td>
                    <td>
                      <div class="notif-table__actions">
                        <button
                          class="rule-menu__btn"
                          onClick={(e) => toggleMenu(rule.id, e)}
                          aria-label="Rule options"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
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

      {/* Kebab menu dropdown (portalled to escape overflow clipping) */}
      <Portal>
        <Show when={openMenuId()}>
          {(_id) => {
            const rule = (rules() ?? []).find((r) => r.id === openMenuId());
            if (!rule) return null;
            return (
              <div
                class="rule-menu__dropdown"
                style={{ position: "fixed", top: `${menuPos().top}px`, left: `${menuPos().left}px`, transform: "translateX(-100%)" }}
              >
                <button class="rule-menu__item" onClick={() => handleEdit(rule)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Edit
                </button>
                <button class="rule-menu__item rule-menu__item--danger" onClick={() => openDeleteConfirm(rule)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Delete
                </button>
              </div>
            );
          }}
        </Show>
      </Portal>

      {/* Delete confirmation modal */}
      <Portal>
        <Show when={deleteTarget()}>
          <div class="modal-overlay" onClick={() => { setDeleteTarget(null); setDeleteConfirmed(false); }}>
            <div
              class="modal-card"
              role="dialog"
              aria-modal="true"
              style="max-width: 440px;"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 class="modal-card__title">Delete rule</h2>
              <p class="modal-card__desc">
                This will permanently delete the <span style="font-weight: 600;">{deleteTarget()!.metric_type === "tokens" ? "token" : "cost"}</span> rule
                ({formatThreshold(deleteTarget()!)} {PERIOD_LABELS[deleteTarget()!.period]?.toLowerCase() ?? deleteTarget()!.period}).
                This action cannot be undone.
              </p>

              <label class="confirm-modal__confirm-row">
                <input
                  type="checkbox"
                  checked={deleteConfirmed()}
                  onChange={(e) => setDeleteConfirmed(e.currentTarget.checked)}
                />
                I understand this action is irreversible
              </label>

              <div class="confirm-modal__footer">
                <button class="btn btn--ghost" onClick={() => { setDeleteTarget(null); setDeleteConfirmed(false); }}>
                  Cancel
                </button>
                <button
                  class="btn btn--danger"
                  disabled={!deleteConfirmed()}
                  onClick={handleDelete}
                >
                  Delete rule
                </button>
              </div>
            </div>
          </div>
        </Show>
      </Portal>

      <LimitRuleModal
        open={showModal()}
        onClose={() => { setShowModal(false); setEditRule(null); }}
        onSave={handleSave}
        hasProvider={hasProvider()}
        editData={editRule() ? {
          metric_type: editRule()!.metric_type,
          threshold: Number(editRule()!.threshold),
          period: editRule()!.period,
          action: editRule()!.action ?? "notify",
        } : null}
      />

      <EmailProviderModal
        open={showEditProvider()}
        initialProvider={emailProvider()?.provider ?? "resend"}
        editMode={true}
        existingKeyPrefix={emailProvider()?.keyPrefix ?? null}
        existingDomain={emailProvider()?.domain ?? null}
        existingNotificationEmail={emailProvider()?.notificationEmail ?? null}
        onClose={() => setShowEditProvider(false)}
        onSaved={() => refetchProvider()}
      />
    </div>
  );
};

export default Limits;
