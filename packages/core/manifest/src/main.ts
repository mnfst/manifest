import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger'
import connectLiveReload from 'connect-livereload'
import * as express from 'express'
import * as livereload from 'livereload'
import { join } from 'path'
import { AppModule } from './app.module'
import { DEFAULT_PORT } from './constants'
import { ManifestModule } from './manifest/manifest.module'
import { AuthModule } from './auth/auth.module'
import { ManifestService } from './manifest/services/manifest/manifest.service'
import { EntityManifest } from '@mnfst/types'

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
    // Generate the Swagger API documentation.
    const apiDoc = new DocumentBuilder()
      .setTitle('Cats example')
      .setDescription('The cats API description')
      .build()

    const document: OpenAPIObject = SwaggerModule.createDocument(app, apiDoc, {
      include: [ManifestModule, AuthModule]
    })

    const manifestService: ManifestService = app.get(ManifestService)

    const entities: EntityManifest[] = manifestService.getEntityManifests()

    console.log(entities)

    entities.forEach((entity: EntityManifest) => {
      document.paths[`/api/${entity.slug}`] = {
        get: {
          tags: [entity.slug],
          summary: `Get all ${entity.slug}`,
          responses: {
            '200': {
              description: `The ${entity.slug} were obtained.`,
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: `#/components/schemas/${entity.slug}`
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    SwaggerModule.setup('api', app, document)
  }

  await app.listen(configService.get('PORT') || DEFAULT_PORT)
}
bootstrap()
