import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response } from 'express'
import { EndpointService } from '../endpoint.service'
import { API_PATH, ENDPOINTS_PATH } from '../../constants'
import { HttpMethod } from '@repo/types'
import { ManifestService } from '../../manifest/services/manifest.service'

/**
 * Extracts the endpoint and params from the request and attaches them to the request object.
 */
@Injectable()
export class MatchEndpointMiddleware implements NestMiddleware {
  constructor(
    private readonly endpointService: EndpointService,
    private readonly manifestService: ManifestService
  ) {}

  use(req: Request, res: Response, next: () => void) {
    console.log('MatchEndpointMiddleware', req.path, req.method)

    const { endpoint, params } = this.endpointService.matchRoutePath({
      path: req.path.replace(`/${API_PATH}/${ENDPOINTS_PATH}`, ''),
      method: req.method as HttpMethod,
      endpoints: this.manifestService.getAppManifest().endpoints
    })

    req['endpoint'] = endpoint
    req['params'] = params as any

    next()
  }
}
