import { NestFactory } from '@nestjs/core'
import * as express from 'express'
import { join } from 'path'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['error', 'warn']
  })

  app.setGlobalPrefix('api')
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  const devMode: boolean = process.argv[2] === 'dev'
  const clientPath = devMode
    ? join(__dirname, '../../../public')
    : join(__dirname, '../public')

  app.use(express.static(clientPath))

  await app.listen(3000)
}
bootstrap()
