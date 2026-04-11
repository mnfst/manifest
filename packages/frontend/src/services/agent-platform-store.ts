import { createSignal } from 'solid-js';
import { platformIcon } from 'manifest-shared';

const [platform, setPlatformSignal] = createSignal<string | null>(null);
const [category, setCategorySignal] = createSignal<string | null>(null);

export function agentPlatform(): string | null {
  return platform();
}

export function setAgentPlatform(value: string | null, cat?: string | null): void {
  setPlatformSignal(value);
  if (cat !== undefined) setCategorySignal(cat);
}

export function agentCategory(): string | null {
  return category();
}

export function agentPlatformIcon(): string | undefined {
  return platformIcon(platform(), category());
}
