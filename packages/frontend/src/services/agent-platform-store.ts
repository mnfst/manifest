import { createSignal } from 'solid-js';
import { PLATFORM_ICONS } from 'manifest-shared';

const [platform, setPlatformSignal] = createSignal<string | null>(null);

export function agentPlatform(): string | null {
  return platform();
}

export function setAgentPlatform(value: string | null): void {
  setPlatformSignal(value);
}

export function agentPlatformIcon(): string | undefined {
  const p = platform();
  return p ? PLATFORM_ICONS[p as keyof typeof PLATFORM_ICONS] : undefined;
}
