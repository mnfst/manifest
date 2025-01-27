import {
  Controller,
  Delete,
  Get,
  HttpException,
  Patch,
  Post,
  Put,
  Req
} from '@nestjs/common'
import { EndpointService } from './endpoint.service'
import { EndpointManifest, HttpMethod } from '../../../types/src'
import { Request } from 'express'
import { ManifestService } from '../manifest/services/manifest.service'
import { API_PATH, ENDPOINTS_PATH } from '../constants'

@Controller(ENDPOINTS_PATH)
export class EndpointController {
  constructor(
    private readonly endpointService: EndpointService,
    private readonly manifestService: ManifestService
  ) {}

  @Get('*')
  @Post('*')
  @Put('*')
  @Patch('*')
  @Delete('*')
  triggerEndpoint(@Req() req: Request) {
    // Get endpoints.
    const endpoints: EndpointManifest[] =
      this.manifestService.getAppManifest().endpoints

    // Match route path.
    const { endpoint, params } = this.endpointService.matchRoutePath({
      path: req.path.replace(`/${API_PATH}/${ENDPOINTS_PATH}`, ''),
      method: req.method as HttpMethod,
      endpoints
    })

    console.log(endpoint, params)

    // If no endpoint is found, return 404.
    if (!endpoint) {
      throw new HttpException('Route not found', 404)
    }

    // Validate policies.

    // Locate handler.

    // Execute handler.

    return 'Hello World!'
  }
}
