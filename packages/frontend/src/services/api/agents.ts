import { fetchJson, fetchMutate } from './core.js';

export function getAgents() {
  return fetchJson('/agents');
}

export interface AgentInfo {
  agent_name: string;
  display_name: string;
  agent_category: string | null;
  agent_platform: string | null;
}

export function getAgentInfo(agentName: string): Promise<AgentInfo | null> {
  return fetchJson<{ agents: AgentInfo[] }>('/agents').then(
    (data) => data?.agents?.find((a) => a.agent_name === agentName) ?? null,
  );
}

export function getAgentKey(agentName: string) {
  return fetchJson<{ keyPrefix: string; apiKey?: string }>(
    `/agents/${encodeURIComponent(agentName)}/key`,
  );
}

export function rotateAgentKey(agentName: string) {
  return fetchMutate<{ apiKey: string }>(`/agents/${encodeURIComponent(agentName)}/rotate-key`, {
    method: 'POST',
  });
}

export function updateAgent(
  currentName: string,
  fields: {
    name?: string;
    agent_category?: string;
    agent_platform?: string;
  },
) {
  return fetchMutate<Record<string, unknown>>(`/agents/${encodeURIComponent(currentName)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

export function renameAgent(currentName: string, newName: string) {
  return updateAgent(currentName, { name: newName });
}

export function deleteAgent(agentName: string) {
  return fetchMutate(`/agents/${encodeURIComponent(agentName)}`, { method: 'DELETE' });
}

export interface CreateAgentParams {
  name: string;
  agent_category?: string;
  agent_platform?: string;
}

export function createAgent(params: CreateAgentParams) {
  return fetchMutate<{
    agent: {
      id: string;
      name: string;
      display_name: string;
      agent_category: string | null;
      agent_platform: string | null;
    };
    apiKey: string;
  }>('/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
