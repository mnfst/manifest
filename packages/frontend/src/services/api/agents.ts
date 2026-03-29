import { fetchJson, fetchMutate, BASE_URL } from './core.js';

export function getAgents() {
  return fetchJson('/agents');
}

export function getAgentKey(agentName: string) {
  return fetchJson<{ keyPrefix: string; apiKey?: string; pluginEndpoint?: string }>(
    `/agents/${encodeURIComponent(agentName)}/key`,
  );
}

export function rotateAgentKey(agentName: string) {
  return fetchMutate<{ apiKey: string }>(
    `${BASE_URL}/agents/${encodeURIComponent(agentName)}/rotate-key`,
    {
      method: 'POST',
    },
  );
}

export function renameAgent(currentName: string, newName: string) {
  return fetchMutate<{ renamed: boolean; name: string }>(
    `${BASE_URL}/agents/${encodeURIComponent(currentName)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    },
  );
}

export function deleteAgent(agentName: string) {
  return fetchMutate(`${BASE_URL}/agents/${encodeURIComponent(agentName)}`, {
    method: 'DELETE',
  });
}

export function createAgent(name: string) {
  return fetchMutate<{ agent: { id: string; name: string }; apiKey: string }>(
    `${BASE_URL}/agents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    },
  );
}
