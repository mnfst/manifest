import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import * as express from 'express'
import { AppModule } from './app.module'
import { DEFAULT_PORT } from './constants'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true
  })

  const configService = app.get(ConfigService)

  app.setGlobalPrefix('api')
  app.use(express.urlencoded({ limit: '50mb', extended: true }))
  app.useGlobalPipes(new ValidationPipe())

  await app.listen(configService.get('PORT') || DEFAULT_PORT)
}
bootstrap()
