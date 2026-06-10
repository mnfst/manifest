import { Navigate, useParams } from '@solidjs/router';
import type { Component } from 'solid-js';

/**
 * Redirects /harnesses/:agentName/messages → /messages?agent=<name> so the
 * global message log opens pre-filtered to the harness the user came from
 * (e.g. via a Recent Messages "View more" link).
 */
const AgentMessagesRedirect: Component = () => {
  const params = useParams<{ agentName: string }>();
  return (
    <Navigate
      href={`/messages?agent=${encodeURIComponent(decodeURIComponent(params.agentName))}`}
    />
  );
};

export default AgentMessagesRedirect;
