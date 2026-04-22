import { createSignal, createResource, Show, onCleanup, type Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { authClient } from '../services/auth-client.js';
import CloudEmailInfo from '../components/CloudEmailInfo.js';
import LimitRuleModal from '../components/LimitRuleModal.js';
import type { LimitRuleData } from '../components/LimitRuleModal.js';
import LimitRuleTable from '../components/LimitRuleTable.js';
import LimitHistoryTable from '../components/LimitHistoryTable.js';
import { KebabMenu, DeleteRuleModal } from '../components/LimitModals.js';
import { toast } from '../services/toast-store.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import {
  getNotificationRules,
  getNotificationLogs,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
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
  const [logs] = createResource(
    () => agentName(),
    (name) => getNotificationLogs(name),
  );
  const [routingStatus] = createResource(() => agentName(), getRoutingStatus);
  const session = authClient.useSession();
  const [showModal, setShowModal] = createSignal(false);
  const [editRule, setEditRule] = createSignal<NotificationRule | null>(null);
  const [openMenuId, setOpenMenuId] = createSignal<string | null>(null);
  const [menuPos, setMenuPos] = createSignal<{ top: number; left: number }>({ top: 0, left: 0 });
  const [deleteTarget, setDeleteTarget] = createSignal<NotificationRule | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  const routingEnabled = () => routingStatus()?.enabled ?? false;
  const hasProvider = () => true;

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

  const blockRulesExceeded = () => {
    const r = rules();
    if (!r) return false;
    return r.some(
      (rule) =>
        (rule.action === 'block' || rule.action === 'both') &&
        rule.is_active &&
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
        <div class="limits-warning-banner" role="alert">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
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

      <Show when={routingStatus() && !routingEnabled()}>
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
            aria-hidden="true"
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

      <div style="margin-bottom: var(--gap-lg);">
        <CloudEmailInfo email={session().data?.user?.email ?? ''} />
      </div>

      <LimitRuleTable
        rules={rules()}
        loading={rules.loading}
        hasProvider={hasProvider()}
        onToggleMenu={toggleMenu}
      />

      <Show when={!logs.loading && (logs() ?? []).length > 0}>
        <div style="margin-top: var(--gap-lg);">
          <LimitHistoryTable logs={logs()} loading={false} />
        </div>
      </Show>

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
    </div>
  );
};

export default Limits;
