import { fetchJson, fetchMutate } from './core.js';

export interface WaitlistStatus {
  joined: boolean;
  joinedAt: string | null;
}

export function getAutofixWaitlistStatus(): Promise<WaitlistStatus> {
  return fetchJson<WaitlistStatus>('/waitlist/autofix');
}

export function joinAutofixWaitlist(): Promise<WaitlistStatus> {
  return fetchMutate<WaitlistStatus>('/waitlist/autofix', {
    method: 'POST',
  });
}
