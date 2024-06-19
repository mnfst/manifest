import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import connectLiveReload from 'connect-livereload'
import * as express from 'express'
import * as livereload from 'livereload'
import { join } from 'path'
import { AppModule } from './app.module'
import { DEFAULT_PORT } from './constants'
import { OpenApiService } from './open-api/services/open-api.service'

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
  const isProduction: boolean = configService.get('NODE_ENV') === 'production'
  const isTest: boolean = configService.get('NODE_ENV') === 'test'

  // Reload the browser when server files change.
  if (!isProduction && !isTest) {
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

  if (!isProduction && !isTest) {
    const openApiService: OpenApiService = app.get(OpenApiService)

    SwaggerModule.setup('api', app, openApiService.generateOpenApiObject(), {
      customfavIcon: 'assets/images/favicon.png',
      customSiteTitle: 'Manifest API Doc',
      customCss: `
        .swagger-ui .topbar { background-color: blue; }`
    })
  }

  await app.listen(configService.get('PORT') || DEFAULT_PORT)
}
bootstrap()
