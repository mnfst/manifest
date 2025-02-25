import { Test, TestingModule } from '@nestjs/testing'
import { EventService } from '../event.service'
import { CrudEventName } from '../../../../types/src'

describe('EventService', () => {
  let service: EventService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventService]
    }).compile()

    service = module.get<EventService>(EventService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should get the related events', () => {
    const beforeCreateEvent: CrudEventName = service.getRelatedCrudEvent(
      'store',
      'before'
    )
    const afterCreateEvent: CrudEventName = service.getRelatedCrudEvent(
      'store',
      'after'
    )

    expect(beforeCreateEvent).toBe('beforeCreate')
    expect(afterCreateEvent).toBe('afterCreate')
  })
})
