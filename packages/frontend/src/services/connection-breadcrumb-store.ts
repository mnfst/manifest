import { createSignal } from 'solid-js';

const [connName, setConnName] = createSignal<string | null>(null);
const [connProviderId, setConnProviderId] = createSignal<string | null>(null);
const [connLabel, setConnLabel] = createSignal<string | null>(null);
const [connBackLink, setConnBackLink] = createSignal<string>('/providers/subscriptions');
const [connBackLabel, setConnBackLabel] = createSignal<string>('Subscriptions');

export function connectionBreadcrumbName(): string | null {
  return connName();
}

export function connectionBreadcrumbProviderId(): string | null {
  return connProviderId();
}

export function connectionBreadcrumbLabel(): string | null {
  return connLabel();
}

export function connectionBreadcrumbBackLink(): string {
  return connBackLink();
}

export function connectionBreadcrumbBackLabel(): string {
  return connBackLabel();
}

export function setConnectionBreadcrumb(
  name: string | null,
  backLink?: string,
  backLabel?: string,
  providerId?: string,
  label?: string,
): void {
  setConnName(name);
  setConnProviderId(providerId ?? null);
  setConnLabel(label ?? null);
  if (backLink) setConnBackLink(backLink);
  if (backLabel) setConnBackLabel(backLabel);
}
