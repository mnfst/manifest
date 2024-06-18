import { Test, TestingModule } from '@nestjs/testing'
import { mockTypeOrmOptions } from './assets/mock-type-orm-options'
import { mockYamlService } from './assets/mock-yaml-service'
import { AppModule } from '../src/app.module'
import { YamlService } from '../src/manifest/services/yaml/yaml.service'
import { TypeOrmModule } from '@nestjs/typeorm'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import { SeederService } from '../src/seed/seeder.service'

let originalConsoleLog

beforeAll(async () => {
  // Prevent console.logs from printing to the console.
  originalConsoleLog = console.log
  console.log = jest.fn()

  // Start the NestJS application mocking some services.
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(YamlService)
    .useValue(mockYamlService)
    .overrideModule(TypeOrmModule)
    .useModule(TypeOrmModule.forRootAsync(mockTypeOrmOptions))
    .compile()

  const app: INestApplication = moduleFixture.createNestApplication()

  // Store request object in global scope to use in tests.
  global.request = supertest(app.getHttpServer())

  await app.init()

  // Seed the database.
  app.get(SeederService).seed()
})

afterAll(() => {
  console.log = originalConsoleLog

  delete global.request
})
