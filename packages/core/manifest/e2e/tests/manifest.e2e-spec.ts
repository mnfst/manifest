import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'

import TestAgent from 'supertest/lib/agent'
import { AppModule } from '../../src/app.module'
import { ConfigModule } from '@nestjs/config'
import generalConfig from '../../src/config/general'
import testDatabaseConfig from '../config/test-database'
import pathsConfig from '../../src/config/paths'
import * as fs from 'fs'
jest.mock('fs')

describe('Manifest (e2e)', () => {
  let app: INestApplication
  let request: TestAgent

  let originalConsoleLog

  const exampleBackendYml: string = `
  name: 'example-backend'
  entities:
    Owner:
      properties:
        - name
        - { name: email, type: email }
  
    Dog:
      properties:
        - name
        - { name: age, type: number }
        - { name: birthdate, type: date }
      belongsTo:
        - Owner`

  beforeAll(() => {
    console.log('beforeAll')
    // originalConsoleLog = console.log
    // console.log = jest.fn()
    ;(fs.readFileSync as jest.Mock).mockImplementation(() => exampleBackendYml)
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  beforeEach(async () => {
    console.log('beforeEach')

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideModule(ConfigModule)
      .useModule(
        ConfigModule.forRoot({
          isGlobal: true,
          load: [generalConfig, testDatabaseConfig, pathsConfig]
        })
      )
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
