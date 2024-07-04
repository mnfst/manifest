import { Test, TestingModule } from '@nestjs/testing'
import { AppModule } from '../src/app.module'
import { YamlService } from '../src/manifest/services/yaml/yaml.service'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { load } from 'js-yaml'
import fs from 'fs'
import { SwaggerModule } from '@nestjs/swagger'
import { OpenApiService } from '../src/open-api/services/open-api.service'

let app: INestApplication

beforeAll(async () => {
  // Set environment variables for testing.
  process.env.NODE_ENV = 'test'
  process.env.DB_DATABASE = ':memory:'
  process.env.DB_DROP_SCHEMA = 'true'

  // Start the NestJS application mocking some services.
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(YamlService)
    .useValue({
      load: () =>
        load(
          fs.readFileSync(
            `${process.cwd()}/e2e/assets/mock-backend.yml`,
            'utf8'
          )
        )
    })
    .compile()

  app = moduleFixture.createNestApplication()

  // Store request object in global scope to use in tests.
  global.request = supertest(app.getHttpServer())

  // Set the SwaggerModule to serve the OpenAPI doc.
  const openApiService = app.get(OpenApiService)
  SwaggerModule.setup('api', app, openApiService.generateOpenApiObject())

  await app.init()
})

afterAll(async () => {
  delete global.request
  await app.close()
})
