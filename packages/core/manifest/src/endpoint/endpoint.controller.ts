import {
  Controller,
  Delete,
  Get,
  HttpException,
  Patch,
  Post,
  Put,
  Req,
  UseGuards
} from '@nestjs/common'
import { EndpointService } from './endpoint.service'
import { Request } from 'express'
import { ENDPOINTS_PATH } from '../constants'
import { PolicyGuard } from '../policy/policy.guard'
import { Rule } from '../policy/decorators/rule.decorator'

@UseGuards(PolicyGuard)
@Controller(ENDPOINTS_PATH)
// TODO: Add Policy Guard here and adapt function as we have policies attached here.
export class EndpointController {
  constructor(private readonly endpointService: EndpointService) {}

  @Get('*')
  @Post('*')
  @Put('*')
  @Patch('*')
  @Delete('*')
  @Rule('dynamic-endpoint') // The dynamic-endpoint rule is based on policies individually set for each endpoint.
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
