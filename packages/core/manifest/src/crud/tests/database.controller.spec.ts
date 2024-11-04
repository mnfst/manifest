import { Test, TestingModule } from '@nestjs/testing'
import { DatabaseController } from '../controllers/database.controller'

describe('DatabaseController', () => {
  let controller: DatabaseController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatabaseController]
    }).compile()

    controller = module.get<DatabaseController>(DatabaseController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
