import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'

import TestAgent from 'supertest/lib/agent'
import { AppModule } from '../../src/app.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { YamlService } from '../../src/manifest/services/yaml/yaml.service'

describe('CRUD (e2e)', () => {
  let app: INestApplication
  let request: TestAgent

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(YamlService)
      .useValue(global.MockYamlService)
      .overrideModule(TypeOrmModule)
      .useModule(TypeOrmModule.forRootAsync(global.mockTypeOrmOptions))
      .compile()

    app = moduleFixture.createNestApplication()
    request = supertest(app.getHttpServer())
    await app.init()
  })

  it('/GET dynamic/:entity', () => {
    return request.get('/dynamic/dogs').expect(200)
  })

  // TODO: Test individually each CRUD endpoint.
  // TODO: Manifest e2e tests.
  // TODO: Seed test database.
})
