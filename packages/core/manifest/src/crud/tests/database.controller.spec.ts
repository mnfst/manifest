import { Test, TestingModule } from '@nestjs/testing'
import { DatabaseController } from '../controllers/database.controller'
import { DatabaseService } from '../services/database.service'

describe('DatabaseController', () => {
  let controller: DatabaseController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatabaseController],
      providers: [
        {
          provide: DatabaseService,
          useValue: {
            isDbEmpty: jest.fn().mockReturnValue(Promise.resolve(true))
          }
        }
      ]
    }).compile()

    controller = module.get<DatabaseController>(DatabaseController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should return true if the database is empty', async () => {
    const res = await controller.isDbEmpty()
    expect(res).toEqual({ empty: true })
  })
})
