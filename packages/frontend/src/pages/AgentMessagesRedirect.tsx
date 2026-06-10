import { Navigate, useParams } from '@solidjs/router';
import type { Component } from 'solid-js';

/**
 * Redirects /harnesses/:agentName/messages → /messages (global message log),
 * carrying the agent through as a filter so the global log opens pre-scoped to
 * the harness the user came from. Keeps backward-compat now that messages has a
 * global home from PR1.
 */
const AgentMessagesRedirect: Component = () => {
  const params = useParams<{ agentName: string }>();
  return <Navigate href={`/messages?agent=${encodeURIComponent(params.agentName)}`} />;
};

export default AgentMessagesRedirect;
