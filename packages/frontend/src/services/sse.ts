import { createSignal } from 'solid-js';

const [pingCount, setPingCount] = createSignal(0);

export { pingCount };

export function connectSse(): () => void {
  const es = new EventSource('/api/v1/events');

  es.addEventListener('ping', () => {
    setPingCount((n) => n + 1);
  });

  return () => es.close();
}
