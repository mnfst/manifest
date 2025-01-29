import {
  Controller,
  Delete,
  Get,
  HttpException,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards
} from '@nestjs/common'
import { Request, Response } from 'express'
import { ENDPOINTS_PATH } from '../constants'
import { PolicyGuard } from '../policy/policy.guard'
import { Rule } from '../policy/decorators/rule.decorator'
import { HandlerService } from '../handler/handler.service'

@UseGuards(PolicyGuard)
@Controller(ENDPOINTS_PATH)
export class EndpointController {
  constructor(private readonly handlerService: HandlerService) {}

  @Get('*')
  @Post('*')
  @Put('*')
  @Patch('*')
  @Delete('*')
  @Rule('dynamic-endpoint') // The dynamic-endpoint rule is based on policies individually set for each endpoint.
  triggerEndpoint(@Req() req: Request, @Res() res: Response): unknown {
    // If no endpoint is found, return 404.
    if (!req['endpoint']) {
      throw new HttpException('Route not found', 404)
    }

    return this.handlerService.trigger(req['endpoint'].handler, req, res)
  }
}
