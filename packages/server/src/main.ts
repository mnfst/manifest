import { NestFactory } from '@nestjs/core'
import * as compression from 'compression'
import * as express from 'express'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  // Those settings fix CORS blockage on large requests
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false
  })

  app.use(compression())

  await app.listen(3000)
}
bootstrap()
