import { createSignal } from 'solid-js';

const [connName, setConnName] = createSignal<string | null>(null);
const [connBackLink, setConnBackLink] = createSignal<string>('/providers/subscriptions');

export function connectionBreadcrumbName(): string | null {
  return connName();
}

export function connectionBreadcrumbBackLink(): string {
  return connBackLink();
}

export function setConnectionBreadcrumb(name: string | null, backLink?: string): void {
  setConnName(name);
  if (backLink) setConnBackLink(backLink);
}
