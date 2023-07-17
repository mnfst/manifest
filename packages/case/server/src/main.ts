import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import * as connectLiveReload from 'connect-livereload'
import * as express from 'express'
import * as livereload from 'livereload'
import { join } from 'path'

import { AppModule } from './app.module'

async function bootstrap() {
  const contributionMode: boolean = process.argv[2] === 'contribution'

  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['error', 'warn']
  })

  app.setGlobalPrefix('api')
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  // Reload the browser when server files change.
  const liveReloadServer = livereload.createServer()
  liveReloadServer.server.once('connection', () => {
    setTimeout(() => {
      liveReloadServer.refresh('/')
    }, 100)
  })
  app.use(connectLiveReload())

  const clientAppFolder: string = contributionMode
    ? join(__dirname, '../../../dist/client')
    : join(__dirname, '../dist/client')

  const publicFolder: string = contributionMode
    ? join(__dirname, '../../_contribution-root/public')
    : join(__dirname, '../public')

  // Serve static files
  app.use(express.static(publicFolder))
  app.use(express.static(clientAppFolder))

  // Redirect all requests to the client app index.
  app.use((req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/storage')) {
      next()
    } else {
      res.sendFile(join(clientAppFolder, 'index.html'))
    }
  })

  const configService = app.get(ConfigService)

  await app.listen(configService.get('port'))
}
bootstrap()
