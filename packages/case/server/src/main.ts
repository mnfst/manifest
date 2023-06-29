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
  const clientFolder: string = devMode
    ? join(__dirname, '../../../public')
    : join(__dirname, '../public')

  // Serve static files from the client app.
  app.use(express.static(clientFolder))

  // Redirect all requests to the client app index.
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      next()
    } else {
      res.sendFile(join(clientFolder, 'index.html'))
    }
  })

  await app.listen(3000)
}
bootstrap()
