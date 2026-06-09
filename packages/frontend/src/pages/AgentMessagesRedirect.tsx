import { Navigate } from '@solidjs/router';
import type { Component } from 'solid-js';

/**
 * Redirects /harnesses/:agentName/messages → /messages (global message log).
 * Keeps backward-compat now that messages has a global home from PR1.
 */
const AgentMessagesRedirect: Component = () => <Navigate href="/messages" />;

export default AgentMessagesRedirect;
