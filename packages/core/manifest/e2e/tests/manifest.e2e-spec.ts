import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'

import TestAgent from 'supertest/lib/agent'
import { TypeOrmModule } from '@nestjs/typeorm'
import { YamlService } from '../../src/manifest/services/yaml/yaml.service'
import { AppModule } from '../../src/app.module'

jest.mock('fs')

describe('Manifest (e2e)', () => {
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

  it('/GET manifest', () => {
    return request
      .get('/manifest')
      .expect(200)
      .expect(JSON.stringify({ status: 'OK' }))
  })
})
