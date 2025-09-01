import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiController } from '../controllers/open-api.controller'

describe('OpenApiController', () => {
  let controller: OpenApiController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpenApiController]
    }).compile()

    controller = module.get<OpenApiController>(OpenApiController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
