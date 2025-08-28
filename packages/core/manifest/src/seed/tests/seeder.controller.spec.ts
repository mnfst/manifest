import { Test, TestingModule } from '@nestjs/testing'
import { SeederController } from '../controllers/seeder/seeder.controller'

describe('SeederController', () => {
  let controller: SeederController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeederController]
    }).compile()

    controller = module.get<SeederController>(SeederController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
