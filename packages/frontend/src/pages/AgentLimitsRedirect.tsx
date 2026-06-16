import { Navigate, useParams } from '@solidjs/router';
import type { Component } from 'solid-js';
import { agentPath } from '../services/routing.js';

/**
 * Redirects /harnesses/:agentName/limits → /harnesses/:agentName/guardrails.
 * Keeps backward-compat for any bookmarks or links using the old path.
 */
const AgentLimitsRedirect: Component = () => {
  const params = useParams<{ agentName: string }>();
  return <Navigate href={agentPath(params.agentName, '/guardrails')} />;
};

export default AgentLimitsRedirect;
