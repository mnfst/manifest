import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'

import TestAgent from 'supertest/lib/agent'
import { AppModule } from '../../src/app.module'

describe('Health (e2e)', () => {
  let app: INestApplication
  let request: TestAgent

  let originalConsoleLog

  beforeAll(() => {
    originalConsoleLog = console.log
    console.log = jest.fn()
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = moduleFixture.createNestApplication()
    request = supertest(app.getHttpServer())
    await app.init()
  })

  it('/GET health', () => {
    return request
      .get('/health')
      .expect(200)
      .expect(JSON.stringify({ status: 'OK' }))
  })
})
