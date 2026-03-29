import { createSignal, createResource, Show, onCleanup, type Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { isLocalMode } from '../services/local-mode.js';
import { authClient } from '../services/auth-client.js';
import CloudEmailInfo from '../components/CloudEmailInfo.js';
import EmailProviderModal from '../components/EmailProviderModal.js';
import EmailProviderSection from '../components/EmailProviderSection.js';
import LimitRuleModal from '../components/LimitRuleModal.js';
import type { LimitRuleData } from '../components/LimitRuleModal.js';
import LimitRuleTable from '../components/LimitRuleTable.js';
import { KebabMenu, DeleteRuleModal, RemoveProviderModal } from '../components/LimitModals.js';
import { toast } from '../services/toast-store.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import {
  getNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  getEmailProvider,
  removeEmailProvider,
  getRoutingStatus,
  type NotificationRule,
} from '../services/api.js';

const Limits: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [rules, { refetch: refetchRules }] = createResource(
    () => agentName(),
    (name) => getNotificationRules(name),
  );
  const [emailProvider, { refetch: refetchProvider }] = createResource(getEmailProvider);
  const [routingStatus] = createResource(() => agentName(), getRoutingStatus);
  const session = authClient.useSession();
  const [showModal, setShowModal] = createSignal(false);
  const [showEditProvider, setShowEditProvider] = createSignal(false);
  const [editRule, setEditRule] = createSignal<NotificationRule | null>(null);
  const [openMenuId, setOpenMenuId] = createSignal<string | null>(null);
  const [menuPos, setMenuPos] = createSignal<{ top: number; left: number }>({ top: 0, left: 0 });
  const [deleteTarget, setDeleteTarget] = createSignal<NotificationRule | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = createSignal(false);
  const [showRemoveProvider, setShowRemoveProvider] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [removingProvider, setRemovingProvider] = createSignal(false);

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
      setTimeout(() => document.addEventListener('click', handleDocClick, { once: true }), 0);
    }
  };

  onCleanup(() => document.removeEventListener('click', handleDocClick));

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
        toast.success('Rule updated');
      } else {
        await createNotificationRule({ agent_name: agentName(), ...data });
        toast.success('Rule created');
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
    setDeleting(true);
    try {
      await deleteNotificationRule(target.id);
      await refetchRules();
      toast.success('Rule deleted');
    } catch {
      // error toast from fetchMutate
    } finally {
      setDeleting(false);
    }
    setDeleteTarget(null);
    setDeleteConfirmed(false);
  };

  const hasEmailRules = () => {
    const r = rules();
    if (!r) return false;
    return r.some((rule) => rule.action === 'notify' || rule.action === 'both');
  };

  const handleRemoveProvider = async () => {
    setRemovingProvider(true);
    try {
      await removeEmailProvider();
      await refetchProvider();
      setShowRemoveProvider(false);
      toast.success('Email provider removed');
    } catch {
      // error toast from fetchMutate
    } finally {
      setRemovingProvider(false);
    }
  };

  const blockRulesExceeded = () => {
    const r = rules();
    if (!r) return false;
    return r.some(
      (rule) =>
        (rule.action === 'block' || rule.action === 'both') &&
        (typeof rule.is_active === 'number' ? !!rule.is_active : rule.is_active) &&
        Number(rule.trigger_count) > 0,
    );
  };

  return (
    <div class="container--sm">
      <Title>{agentDisplayName() ?? agentName()} Limits - Manifest</Title>
      <Meta
        name="description"
        content={`Configure limits and alerts for ${agentDisplayName() ?? agentName()}.`}
      />

      <div class="page-header">
        <div>
          <h1>Limits</h1>
          <span class="breadcrumb">
            {agentDisplayName() ?? agentName()} &rsaquo; Get notified or block requests when token
            or cost thresholds are exceeded
          </span>
        </div>
        <button
          class="btn btn--primary btn--sm"
          onClick={() => {
            setEditRule(null);
            setShowModal(true);
          }}
        >
          + Create rule
        </button>
      </div>

      <Show when={blockRulesExceeded()}>
        <div class="limits-warning-banner">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            One or more hard limits triggered. New proxy requests for this agent will be blocked
            until the usage resets in the next period.
          </span>
        </div>
      </Show>

      <Show when={routingStatus() && !routingEnabled() && !isLocalMode()}>
        <div class="limits-routing-cta">
          <svg
            width="20"
            height="20"
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
          <div>
            <strong>Enable routing to set hard limits</strong>
            <p>
              Hard limits automatically block proxy requests when usage exceeds a threshold. Email
              alerts work without routing &mdash; only hard limits require it.
            </p>
          </div>
        </div>
      </Show>

      <Show when={!isLocalMode()}>
        <div style="margin-bottom: var(--gap-lg);">
          <CloudEmailInfo email={session().data?.user?.email ?? ''} />
        </div>
      </Show>

      <Show when={isLocalMode()}>
        <EmailProviderSection
          emailProvider={emailProvider()}
          loading={emailProvider.loading}
          onConfigured={refetchProvider}
          onEdit={() => setShowEditProvider(true)}
          onRemove={() => setShowRemoveProvider(true)}
        />
      </Show>

      <LimitRuleTable
        rules={rules()}
        loading={rules.loading}
        hasProvider={hasProvider()}
        onToggleMenu={toggleMenu}
      />

      <KebabMenu
        openMenuId={openMenuId()}
        menuPos={menuPos()}
        rules={rules() ?? []}
        onEdit={handleEdit}
        onDelete={openDeleteConfirm}
      />

      <DeleteRuleModal
        target={deleteTarget()}
        confirmed={deleteConfirmed()}
        deleting={deleting()}
        onConfirmChange={setDeleteConfirmed}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteConfirmed(false);
        }}
        onDelete={handleDelete}
      />

      <RemoveProviderModal
        open={showRemoveProvider()}
        hasEmailRules={hasEmailRules()}
        removing={removingProvider()}
        onCancel={() => setShowRemoveProvider(false)}
        onRemove={handleRemoveProvider}
      />

      <LimitRuleModal
        open={showModal()}
        onClose={() => {
          setShowModal(false);
          setEditRule(null);
        }}
        onSave={handleSave}
        hasProvider={hasProvider()}
        editData={
          editRule()
            ? {
                metric_type: editRule()!.metric_type,
                threshold: Number(editRule()!.threshold),
                period: editRule()!.period,
                action: editRule()!.action ?? 'notify',
              }
            : null
        }
      />

      <EmailProviderModal
        open={showEditProvider()}
        initialProvider={emailProvider()?.provider ?? 'resend'}
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
