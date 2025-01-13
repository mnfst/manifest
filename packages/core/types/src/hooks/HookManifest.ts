import { HookEventName } from '../crud'
import { HookType } from './HookType'

export interface HookManifest {
  event: HookEventName
  type: HookType
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers: {
    [k: string]: unknown
  }
}
