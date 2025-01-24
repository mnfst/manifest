import { Injectable } from '@nestjs/common'
import {
  HookEventName,
  HookManifest,
  HookSchema,
  WebhookPayload
} from '@repo/types'

@Injectable()
export class HookService {
  /**
   * Transforms a hook schema into a hook manifest.
   *
   * @param hookSchema The hook schema.
   * @param event The hook event name which the hook is related to
   *
   * @returns The hook manifest.
   */
  transformHookSchemaIntoHookManifest(
    hookSchema: HookSchema,
    event: HookEventName
  ): HookManifest {
    return {
      event,
      type: 'webhook',
      url: hookSchema.url,
      method: hookSchema.method || 'POST',
      headers: hookSchema.headers || {}
    }
  }

  /**
   * Triggers a webhook.
   *
   * @param hookManifest The hook manifest.
   * @param entity The entity slug.
   *
   * @returns A promise that resolves when the webhook is triggered.
   */
  async triggerWebhook(
    hookManifest: HookManifest,
    entity: string,
    record: object
  ): Promise<void> {
    const headers = Object.assign(
      {
        'Content-Type': 'application/json'
      },
      hookManifest.headers
    )

    const payload: WebhookPayload = {
      event: hookManifest.event,
      createdAt: new Date(),
      entity,
      record
    }

    try {
      await fetch(hookManifest.url, {
        method: hookManifest.method,
        headers,
        body:
          hookManifest.method !== 'GET' ? JSON.stringify(payload) : undefined // GET requests don't have a body.
      })
    } catch {
      console.error(
        `Failed to trigger webhook "${hookManifest.url}" for event "${hookManifest.event}" (entity: "${entity}").`
      )
    }
  }
}
