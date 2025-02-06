import { HttpMethod } from '../common/HttpMethod'
import { HookEventName } from '../crud'
import { HookType } from './HookType'

export interface HookManifest {
  event: HookEventName
  type: HookType
  url: string
  method: HttpMethod
  headers: {
    [k: string]: string
  }
}
