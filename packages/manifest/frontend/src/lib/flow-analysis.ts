import type { Flow } from '@manifest/shared';

/**
 * Determines the current state of a flow based on its node composition.
 * Returns categorized node arrays and boolean flags for each type.
 */
export function getFlowState(flow: Flow) {
  const nodes = flow.nodes ?? [];
  const userIntentNodes = nodes.filter((n) => n.type === 'UserIntent');
  const registryComponentNodes = nodes.filter(
    (n) => n.type === 'RegistryComponent',
  );
  const blankComponentNodes = nodes.filter(
    (n) => n.type === 'BlankComponent',
  );
  const returnNodes = nodes.filter((n) => n.type === 'Return');
  const callFlowNodes = nodes.filter((n) => n.type === 'CallFlow');
  const apiCallNodes = nodes.filter((n) => n.type === 'ApiCall');
  const transformNodes = nodes.filter(
    (n) => n.type === 'JavaScriptCodeTransform',
  );
  const linkNodes = nodes.filter((n) => n.type === 'Link');

  const hasUserIntentNodes = userIntentNodes.length > 0;
  const hasRegistryComponentNodes = registryComponentNodes.length > 0;
  const hasBlankComponentNodes = blankComponentNodes.length > 0;
  const hasReturnNodes = returnNodes.length > 0;
  const hasCallFlowNodes = callFlowNodes.length > 0;
  const hasApiCallNodes = apiCallNodes.length > 0;
  const hasTransformNodes = transformNodes.length > 0;
  const hasLinkNodes = linkNodes.length > 0;
  const hasSteps =
    hasRegistryComponentNodes ||
    hasBlankComponentNodes ||
    hasReturnNodes ||
    hasCallFlowNodes ||
    hasApiCallNodes ||
    hasTransformNodes ||
    hasLinkNodes;

  return {
    hasUserIntentNodes,
    hasRegistryComponentNodes,
    hasBlankComponentNodes,
    hasReturnNodes,
    hasCallFlowNodes,
    hasApiCallNodes,
    hasTransformNodes,
    hasLinkNodes,
    hasSteps,
    userIntentNodes,
    registryComponentNodes,
    blankComponentNodes,
    returnNodes,
    callFlowNodes,
    apiCallNodes,
    transformNodes,
    linkNodes,
  };
}
