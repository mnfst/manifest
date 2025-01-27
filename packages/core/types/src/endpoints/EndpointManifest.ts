import { HttpMethod } from '../common/HttpMethod'
import { PolicyManifest } from '../manifests'
import { NestMiddleware } from '@nestjs/common'
import * as Express from 'express'

/**
 * Represents an endpoint manifest.
 */
export interface EndpointManifest {
  name: string
  path: string
  method: HttpMethod
  params: object
  handler: NestMiddleware<Express.Request, Express.Response>
  policies: PolicyManifest[]
}
