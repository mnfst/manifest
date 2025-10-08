import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger'
import connectLiveReload from 'connect-livereload'
import * as express from 'express'
import * as livereload from 'livereload'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { readFileSync } from 'fs'
import { join } from 'path'
import { AppModule } from './app.module'
import {
  API_PATH,
  DEFAULT_PORT,
  DEFAULT_TOKEN_SECRET_KEY,
  STORAGE_PATH
} from './constants'
import { OpenApiService } from './open-api/services/open-api.service'
import { EntityTypeService } from './entity/services/entity-type.service'
import { EntityTsTypeInfo } from './entity/types/entity-ts-type-info'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['error', 'warn']
  })

  // Get the underlying Express instance and disable X-Powered-By header.
  app.getHttpAdapter().getInstance().disable('x-powered-by')

  const configService = app.get(ConfigService)

  app.setGlobalPrefix(API_PATH)
  app.use(express.urlencoded({ limit: '50mb', extended: true }))
  app.useGlobalPipes(new ValidationPipe())

  // Live reload.
  const isProduction: boolean = configService.get('NODE_ENV') === 'production'
  const isTest: boolean = configService.get('NODE_ENV') === 'test'

  if (
    isProduction &&
    configService.get('tokenSecretKey') === DEFAULT_TOKEN_SECRET_KEY
  ) {
    throw new Error(
      'Token secret key not defined. Please set a custom token secret key to run in production environment adding TOKEN_SECRET_KEY in your env file.'
    )
  }

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

  const adminPanelFolder: string = configService.get('paths').adminPanelFolder
  app.use(express.static(adminPanelFolder))

  const publicFolder: string = configService.get('paths').publicFolder
  const storagePath = join(publicFolder, STORAGE_PATH)

  app.use(`/${STORAGE_PATH}`, express.static(storagePath))

  // Redirect all requests to the client app index.
  app.use((req, res, next) => {
    if (
      req.url.startsWith(`/${API_PATH}`) ||
      req.url.startsWith(`/${STORAGE_PATH}`)
    ) {
      next()
    } else {
      res.sendFile(join(adminPanelFolder, 'index.html'))
    }
  })

  // Open API documentation.

  if (configService.get('showOpenApiDocs')) {
    // Start with generating types.
    const entityTypeService: EntityTypeService = app.get(EntityTypeService)
    const entityTypeInfos: EntityTsTypeInfo[] =
      entityTypeService.generateEntityTypeInfos()

    // Write TypeScript interfaces to file.
    fs.writeFileSync(
      `${configService.get('paths').generatedFolder}/types.ts`,
      entityTypeInfos
        .map((entityTypeInfo) =>
          entityTypeService.generateTSInterfaceFromEntityTypeInfo(
            entityTypeInfo
          )
        )
        .join('\n'),
      'utf8'
    )

    const openApiService: OpenApiService = app.get(OpenApiService)

    const openApiObject: OpenAPIObject =
      openApiService.generateOpenApiObject(entityTypeInfos)

    // Cross-platform custom CSS loading for Swagger
    let customCss = '';
    const devCssPath = join(__dirname, '../open-api/styles/swagger-custom.css');
    const prodCssPath = join(__dirname, '../../open-api/styles/swagger-custom.css');
    if (fs.existsSync(devCssPath)) {
      customCss = readFileSync(devCssPath, 'utf8');
    } else if (fs.existsSync(prodCssPath)) {
      customCss = readFileSync(prodCssPath, 'utf8');
    }
    SwaggerModule.setup(API_PATH, app, openApiObject, {
      customfavIcon: 'assets/images/open-api/favicon.ico',
      customSiteTitle: 'Manifest API Doc',
      customCss
    })

    // Write OpenAPI spec to file.
    const yamlString: string = yaml.dump(openApiObject)
    fs.writeFileSync(
      `${configService.get('paths').generatedFolder}/openapi.yml`,
      yamlString,
      'utf8'
    )
  }

  await app.listen(configService.get('PORT') || DEFAULT_PORT)
}
bootstrap()
