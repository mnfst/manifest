import { fetchJson, fetchMutate } from './core.js';

export function getMessageRetention(): Promise<{ days: number | null }> {
	return fetchJson<{ days: number | null }>('/message-retention');
}

export function setMessageRetention(days: number | null): Promise<{ days: number | null }> {
	return fetchMutate<{ days: number | null }>('/message-retention', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ days }),
	});
}
