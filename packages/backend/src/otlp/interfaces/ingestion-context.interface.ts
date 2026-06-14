export interface IngestionContext {
  tenantId: string;
  agentId: string;
  agentName: string;
  /**
   * The tenant's owning user, when one exists. Informational attribution
   * only (e.g. agent_messages.user_id) — never used for scoping or auth.
   */
  userId: string | null;
}
