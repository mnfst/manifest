import type {
  App,
  AppWithFlowCount,
  Flow,
  ExecutionListItem,
  FlowExecution,
  PendingInvitation,
} from '@manifest/shared';
import type { AppEntity } from '../app/app.entity';
import type { FlowEntity } from '../flow/flow.entity';
import type { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import type { PendingInvitationEntity } from '../auth/pending-invitation.entity';

export function entityToApp(entity: AppEntity): App {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    slug: entity.slug,
    themeVariables: entity.themeVariables,
    status: entity.status,
    logoUrl: entity.logoUrl,
    createdAt: entity.createdAt?.toISOString(),
    updatedAt: entity.updatedAt?.toISOString(),
  };
}

export function entityToAppWithFlowCount(
  entity: AppEntity & { flowCount: number },
): AppWithFlowCount {
  return {
    ...entityToApp(entity),
    flowCount: entity.flowCount ?? 0,
  };
}

export function entityToFlow(entity: FlowEntity): Flow {
  return {
    id: entity.id,
    appId: entity.appId,
    name: entity.name,
    description: entity.description,
    isActive: entity.isActive ?? true,
    nodes: entity.nodes ?? [],
    connections: entity.connections ?? [],
    createdAt: entity.createdAt?.toISOString(),
    updatedAt: entity.updatedAt?.toISOString(),
  };
}

export function toExecutionListItem(
  entity: FlowExecutionEntity,
): ExecutionListItem {
  const duration =
    entity.endedAt && entity.startedAt
      ? new Date(entity.endedAt).getTime() -
        new Date(entity.startedAt).getTime()
      : undefined;

  const params = entity.initialParams;
  const firstKey = Object.keys(params)[0];
  const firstValue = firstKey ? String(params[firstKey]) : '';
  const initialParamsPreview =
    firstValue.length > 50 ? firstValue.substring(0, 50) + '...' : firstValue;

  return {
    id: entity.id,
    flowId: entity.flowId,
    flowName: entity.flowName,
    flowToolName: entity.flowToolName,
    status: entity.status,
    startedAt: entity.startedAt.toISOString(),
    endedAt: entity.endedAt?.toISOString(),
    duration,
    initialParamsPreview,
    isPreview: entity.isPreview,
  };
}

export function toFlowExecution(
  entity: FlowExecutionEntity,
): FlowExecution {
  return {
    id: entity.id,
    flowId: entity.flowId,
    flowName: entity.flowName,
    flowToolName: entity.flowToolName,
    status: entity.status,
    startedAt: entity.startedAt.toISOString(),
    endedAt: entity.endedAt?.toISOString(),
    initialParams: entity.initialParams,
    nodeExecutions: entity.nodeExecutions,
    errorInfo: entity.errorInfo,
    isPreview: entity.isPreview,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export function invitationToDto(
  entity: PendingInvitationEntity,
  inviterName?: string,
): PendingInvitation {
  return {
    id: entity.id,
    email: entity.email,
    role: entity.role,
    appId: entity.appId,
    invitedBy: entity.inviterId,
    inviterName,
    createdAt: entity.createdAt.toISOString(),
  };
}
