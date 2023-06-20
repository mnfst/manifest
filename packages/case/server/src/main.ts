import { NestFactory } from '@nestjs/core'
import * as express from 'express'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true })

  app.setGlobalPrefix('api')
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  // Static files (including client app).
  app.use(express.static('public/client'))

  await app.listen(3000)
}
bootstrap()
