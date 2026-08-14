import { createSignal } from 'solid-js';

const [name, setName] = createSignal<string | null>(null);

export function agentDisplayName(): string | null {
  return name();
}

export function setAgentDisplayName(value: string | null): void {
  setName(value);
}
