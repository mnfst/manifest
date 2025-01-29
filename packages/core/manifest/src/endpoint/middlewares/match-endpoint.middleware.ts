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
    const { endpoint, params } = this.endpointService.matchRoutePath({
      path: req.path.replace(`/${API_PATH}/${ENDPOINTS_PATH}`, ''),
      method: req.method as HttpMethod,
      endpoints: this.manifestService.getAppManifest().endpoints
    })

    req['endpoint'] = endpoint

    // We can't store the params directly in req.params because it's a read-only object, we temporarily store it in req['dynamicParams'] and then overwrite req.params later.
    req['dynamicParams'] = params

    next()
  }
}
