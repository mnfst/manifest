import { HttpMethod } from '../common/HttpMethod'
import { CrudEventName } from '../crud'
import { HookType } from './HookType'

export interface HookManifest {
  event: CrudEventName
  type: HookType
  url: string
  method: HttpMethod
  headers: {
    [k: string]: string
  }
}
