import { NestFactory } from '@nestjs/core'
import * as express from 'express'
import { join } from 'path'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true })

  app.setGlobalPrefix('api')
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  // Static files (including client app).
  console.log(process.argv[2])

  // When working in "linkMode" (using npm link), the path to the client app is different.
  const linkMode: boolean = process.argv[2] === 'link'
  const clientPath = linkMode
    ? join(__dirname, '../public')
    : join(__dirname, '../../../public')

  console.log(clientPath)

  app.use(express.static(clientPath))

  await app.listen(3000)
}
bootstrap()
