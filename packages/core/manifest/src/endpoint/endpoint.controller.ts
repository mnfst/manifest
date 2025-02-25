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
  @Rule('dynamic-endpoint') // The dynamic-endpoint rule is based on policies individually set for each endpoint.
  triggerGetEndpoint(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<unknown> {
    return this.handleRoute(req, res)
  }

  @Post('*')
  @Rule('dynamic-endpoint')
  triggerPostEndpoint(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<unknown> {
    return this.handleRoute(req, res)
  }

  @Put('*')
  @Rule('dynamic-endpoint')
  triggerPutEndpoint(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<unknown> {
    return this.handleRoute(req, res)
  }

  @Patch('*')
  @Rule('dynamic-endpoint')
  triggerPatchEndpoint(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<unknown> {
    return this.handleRoute(req, res)
  }

  @Delete('*')
  @Rule('dynamic-endpoint')
  triggerDeleteEndpoint(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<unknown> {
    return this.handleRoute(req, res)
  }

  /**
   * All the routes lead to Rome.
   */
  private async handleRoute(req: Request, res: Response): Promise<unknown> {
    // If no endpoint is found, return 404.
    if (!req['endpoint']) {
      throw new HttpException('Route not found', 404)
    }

    // We overwrite the original params (that are irrelevant) with the dynamic params that we have extracted.
    req['params'] = req['dynamicParams']

    return this.handlerService.trigger({
      path: req['endpoint'].handler,
      req,
      res
    })
  }
}
