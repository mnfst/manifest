import { HookEventName } from '../crud'

/**
 * Represents a webhook payload.
 */
export interface WebhookPayload {
  event: HookEventName
  createdAt: Date
  entity: string
  record: object
}
