import { CrudEventName } from '../crud'

/**
 * Represents a webhook payload.
 */
export interface WebhookPayload {
  event: CrudEventName
  createdAt: Date
  entity: string
  record: object
}
