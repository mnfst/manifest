import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import connectLiveReload from 'connect-livereload'
import * as express from 'express'
import * as livereload from 'livereload'
import { join } from 'path'
import { AppModule } from './app.module'
import { DEFAULT_PORT } from './constants'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['error', 'warn']
  })

  const configService = app.get(ConfigService)

  app.setGlobalPrefix('api')
  app.use(express.urlencoded({ limit: '50mb', extended: true }))
  app.useGlobalPipes(new ValidationPipe())

  // Live reload.
  const production: boolean = configService.get('NODE_ENV') === 'production'

  // Reload the browser when server files change.
  if (!production) {
    const liveReloadServer = livereload.createServer()
    liveReloadServer.server.once('connection', () => {
      setTimeout(() => {
        liveReloadServer.refresh('/')
      }, 100)
    })
    app.use(connectLiveReload())
  }

  const adminPath: string = configService.get('paths').admin

  app.use(express.static(adminPath))

  // Redirect all requests to the client app index.
  app.use((req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/storage')) {
      next()
    } else {
      res.sendFile(join(adminPath, 'index.html'))
    }
  })

  await app.listen(configService.get('PORT') || DEFAULT_PORT)
}
bootstrap()
