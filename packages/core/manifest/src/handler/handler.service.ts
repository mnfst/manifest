import { HttpException, Injectable } from '@nestjs/common'
import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { ConfigService } from '@nestjs/config'
import { BackendSDK } from '../sdk/backend-sdk'

@Injectable()
export class HandlerService {
  constructor(
    private configService: ConfigService,
    private readonly sdk: BackendSDK
  ) {}

  /**
   * Trigger the handler function and return the response.
   *
   * @param path Handler path
   * @param req Request object
   * @param res Response object
   *
   * @returns Handler response
   */
  async trigger(path: string, req: Request, res: Response): Promise<unknown> {
    const handlerFn = await this.importHandler(path)

    return handlerFn(req, res, this.sdk)
  }

  /**
   * Import handler function to trigger the handler.
   *
   * @param handler Handler path
   */
  async importHandler(handler: string) {
    // Construct the handler file path.
    const handlerPath = path.resolve(
      this.configService.get('paths').handlersFolder,
      `${handler}.js`
    )

    if (!fs.existsSync(handlerPath)) {
      throw new HttpException('Handler not found', 404)
    }

    // Import the handler.
    const module = await import(handlerPath)

    if (typeof module.default !== 'function') {
      throw new HttpException('Handler is invalid', 404)
    }

    return module.default
  }
}
