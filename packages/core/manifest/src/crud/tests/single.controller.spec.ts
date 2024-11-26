import { Test, TestingModule } from '@nestjs/testing'
import { SingleController } from '../controllers/single.controller'

// TODO: Move this to end2end tests.

describe('SingleController', () => {
  let controller: SingleController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SingleController]
    }).compile()

    controller = module.get<SingleController>(SingleController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('get', () => {
    it('should return an 403 error if the entity is not single', async () => {
      return false
    })

    it('should return an 404 error if the entity is not found', async () => {
      return false
    })

    it('should return the record as a JSON object', async () => {
      return false
    })
  })

  describe('update', () => {
    it('should return an 403 error if the entity is not single', async () => {
      return false
    })

    it('should return an 404 error if the entity is not found', async () => {
      return false
    })

    it('should apply validation rules to the request body', async () => {
      return false
    })

    it('should return the updated record as a JSON object', async () => {
      return false
    })
  })
})
