import { HookEventName } from '../crud'

// The payload of a webhook.
export interface WebhookPayload {
  event: HookEventName
  createdAt: Date
  entity: string
  record: object
}
