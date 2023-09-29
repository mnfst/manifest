import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import * as connectLiveReload from 'connect-livereload'
import * as express from 'express'
import * as livereload from 'livereload'
import { join } from 'path'

import { AppModule } from './app.module'

/**
 * Bootstrap function to initialize the application
 */
async function bootstrap() {
  // Create the NestJS application
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['error', 'warn']
  })

  // Get the configuration service
  const configService = app.get(ConfigService)

  // Set global prefix for the application
  app.setGlobalPrefix('api')
  
  // Use urlencoded middleware
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  // Reload the browser when server files change.
  const liveReloadServer = livereload.createServer()
  liveReloadServer.server.once('connection', () => {
    setTimeout(() => {
      liveReloadServer.refresh('/')
    }, 100)
  })
  
  // Use livereload middleware
  app.use(connectLiveReload())

  // Get client app folder and public folder from configuration service
  const clientAppFolder: string = configService.get('clientAppFolder')
  const publicFolder: string = configService.get('publicFolder')

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

  // Listen on the port specified in the configuration service
  await app.listen(configService.get('port'))
}

// Call the bootstrap function to start the application
bootstrap()
