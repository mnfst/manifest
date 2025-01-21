import { Injectable } from '@nestjs/common'
import { HookEventName, HookManifest, HookSchema } from '../../../types/src'

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
   *
   * @returns A promise that resolves when the webhook is triggered.
   */
  async triggerWebhook(hookManifest: HookManifest): Promise<void> {
    // TODO: Implement webhook trigger.
  }
}
