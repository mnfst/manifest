import { Test, TestingModule } from '@nestjs/testing'
import { AppModule } from '../src/app.module'
import { YamlService } from '../src/manifest/services/yaml.service'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { load } from 'js-yaml'
import fs from 'fs'
import { SwaggerModule } from '@nestjs/swagger'
import { OpenApiService } from '../src/open-api/services/open-api.service'
import { SeederService } from '../src/seed/seeder.service'

let app: INestApplication

beforeAll(async () => {
  // Set environment variables for testing.
  process.env.NODE_ENV = 'test'
  process.env.DB_DATABASE = ':memory:'
  process.env.DB_DROP_SCHEMA = 'true'
  process.env.TOKEN_SECRET_KEY = 'test'

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

  // Set the SwaggerModule to serve the OpenAPI doc.
  const openApiService = app.get(OpenApiService)
  SwaggerModule.setup('api', app, openApiService.generateOpenApiObject())

  await app.init()
})

afterAll(async () => {
  delete global.request
  await app.close()
})
