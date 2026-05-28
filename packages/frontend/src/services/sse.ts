import { createSignal } from 'solid-js';

// pingCount counts ANY event from the bus (legacy back-compat for callers that
// don't care which kind fired). New code should depend on the targeted
// signals so a routing-only change doesn't refetch the message log etc.
const [pingCount, setPingCount] = createSignal(0);
const [messagePing, setMessagePing] = createSignal(0);
const [agentPing, setAgentPing] = createSignal(0);
const [routingPing, setRoutingPing] = createSignal(0);

export { pingCount, messagePing, agentPing, routingPing };

export function connectSse(): () => void {
  const es = new EventSource('/api/v1/events');

  const bumpPing = () => setPingCount((n) => n + 1);

  // Coalesce message-class bumps. A chatty agent emits one SSE `message` event
  // per ingested record, and every bump refetches the Overview/MessageLog
  // resources. Collapsing a burst into a single bump every 500ms keeps backend
  // QPS sane at the cost of a small refresh delay on the dashboard.
  let messageBumpTimer: ReturnType<typeof setTimeout> | null = null;
  const bumpMessagePing = () => {
    if (messageBumpTimer) return;
    messageBumpTimer = setTimeout(() => {
      messageBumpTimer = null;
      setMessagePing((n) => n + 1);
    }, 500);
  };

  // Legacy generic 'ping' from older deployments — keep listening so a partial
  // upgrade (old backend, new frontend) still triggers refetches. The safe
  // default is to treat unknown 'ping' as a message-class change since that's
  // the kind the bus emitted before typed events landed.
  es.addEventListener('ping', () => {
    bumpMessagePing();
    bumpPing();
  });

  es.addEventListener('message', () => {
    bumpMessagePing();
    bumpPing();
  });
  es.addEventListener('agent', () => {
    setAgentPing((n) => n + 1);
    bumpPing();
  });
  es.addEventListener('routing', () => {
    setRoutingPing((n) => n + 1);
    bumpPing();
  });

  return () => {
    if (messageBumpTimer) clearTimeout(messageBumpTimer);
    messageBumpTimer = null;
    es.close();
  };
}
