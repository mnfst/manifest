export interface IngestionContext {
  tenantId: string;
  agentId: string;
  agentName: string;
  userId: string;
  // Agent platform declared at creation time (e.g. 'codex', 'claude-code').
  // Drives protocol-specific stream encoding in the proxy — Codex requires
  // the full OpenAI Responses SSE lifecycle while other coding assistants
  // accept a delta-only stream.
  agentPlatform?: string | null;
}
