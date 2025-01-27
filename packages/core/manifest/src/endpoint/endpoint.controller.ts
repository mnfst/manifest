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
import { Request } from 'express'
import { ENDPOINTS_PATH } from '../constants'

@Controller(ENDPOINTS_PATH)
// TODO: Add Policy Guard here and adapt function as we have policies attached here.
export class EndpointController {
  constructor(private readonly endpointService: EndpointService) {}

  @Get('*')
  @Post('*')
  @Put('*')
  @Patch('*')
  @Delete('*')
  triggerEndpoint(@Req() req: Request) {
    console.log(req['endpoint'], req['params'])

    // If no endpoint is found, return 404.
    if (!req['endpoint']) {
      throw new HttpException('Route not found', 404)
    }

    // Locate handler.

    // Execute handler.

    return 'Hello World!'
  }
}
