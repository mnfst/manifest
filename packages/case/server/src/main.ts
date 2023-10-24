import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as connectLiveReload from 'connect-livereload'
import * as express from 'express'
import * as livereload from 'livereload'
import { join } from 'path'

import { AppModule } from './app.module'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['error', 'warn']
  })

  const configService = app.get(ConfigService)

  app.setGlobalPrefix('api')
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  const production: boolean = configService.get('nodeEnv') === 'production'

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

  // Build the swagger doc.
  const config = new DocumentBuilder()
    .setTitle('CASE API Doc')
    .setDescription(
      '<p>Use the "Authorize" button to get a JWT token.</p><p>Replace {entity} with the entity slug.</p'
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT'
    )
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    include: [DynamicEntityModule]
  })
  SwaggerModule.setup('api', app, document, {
    customCss: '.swagger-ui .topbar { display: none }',
    customfavIcon: 'assets/images/favicon.png',
    customSiteTitle: 'CASE API Doc'
  })

  await app.listen(configService.get('port'))
}
bootstrap()
