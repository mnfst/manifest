import { Test, TestingModule } from '@nestjs/testing'
import { AppModule } from '../src/app.module'
import { YamlService } from '../src/manifest/services/yaml.service'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import * as yaml from 'js-yaml'
import fs from 'fs'
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger'
import { OpenApiService } from '../src/open-api/services/open-api.service'
import { SeederService } from '../src/seed/services/seeder.service'
import path from 'path'
import { EntityTypeService } from '../src/entity/services/entity-type.service'
import { EntityTsTypeInfo } from '../src/entity/types/entity-ts-type-info'
import { ConfigService } from '@nestjs/config'

let app: INestApplication
let originalConsoleLog: any

beforeAll(() => {
  originalConsoleLog = console.log
  console.log = jest.fn()
})

afterAll(() => {
  console.log = originalConsoleLog
})

beforeAll(async () => {
  // Set environment variables for testing.
  process.env.NODE_ENV = 'test'
  process.env.TOKEN_SECRET_KEY = 'test'
  process.env.MANIFEST_HANDLERS_FOLDER = path.join(
    __dirname,
    'manifest',
    'handlers'
  )

  process.env.DB_CONNECTION = 'sqlite'
  process.env.DB_PATH = ':memory:'
  process.env.DB_DROP_SCHEMA = 'true'

  // Start the NestJS application mocking some services.
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(YamlService)
    .useValue({
      load: () =>
        yaml.load(
          fs.readFileSync(
            `${process.cwd()}/e2e/manifest/mock-manifest.yml`,
            'utf8'
          )
        )
    })
    .compile()

  app = moduleFixture.createNestApplication()

  // Seed the database with the mock data.
  const seedService = app.get(SeederService)
  await seedService.seed('admin')
  await seedService.seed('cat')
  await seedService.seed('university')
  await seedService.seed('author')
  await seedService.seed('tag')
  await seedService.seed('note')

  // Store request object in global scope to use in tests.
  global.request = supertest(app.getHttpServer())

  const configService = app.get(ConfigService)

  const entityTypeService: EntityTypeService = app.get(EntityTypeService)
  const entityTypeInfos: EntityTsTypeInfo[] =
    entityTypeService.generateEntityTypeInfos()

  // Write TypeScript interfaces to file.
  fs.writeFileSync(
    `${configService.get('paths').generatedFolder}/types.ts`,
    entityTypeInfos
      .map((entityTypeInfo) =>
        entityTypeService.generateTSInterfaceFromEntityTypeInfo(entityTypeInfo)
      )
      .join('\n'),
    'utf8'
  )
  // Set the SwaggerModule to serve the OpenAPI doc.
  const openApiService = app.get(OpenApiService)
  const openApiObject: OpenAPIObject =
    openApiService.generateOpenApiObject(entityTypeInfos)

  SwaggerModule.setup(
    'api',
    app,
    openApiService.generateOpenApiObject(entityTypeInfos)
  )

  // Write OpenAPI spec to file.
  const yamlString: string = yaml.dump(openApiObject)
  fs.writeFileSync(
    `${configService.get('paths').generatedFolder}/openapi.yml`,
    yamlString,
    'utf8'
  )

  await app.init()
})

afterAll(async () => {
  delete global.request
  await app.close()
})
