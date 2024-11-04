import { Test } from '@nestjs/testing'
import { IsDbEmptyGuard } from '../guards/is-db-empty.guard'
import { DatabaseService } from '../../crud/services/database.service'

describe('IsDbEmptyGuard', () => {
  let databaseService: DatabaseService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IsDbEmptyGuard,
        {
          provide: DatabaseService,
          useValue: {
            isDbEmpty: jest.fn().mockReturnValue(Promise.resolve(true))
          }
        }
      ]
    }).compile()

    databaseService = module.get<DatabaseService>(DatabaseService)
  })

  it('should be defined', () => {
    expect(new IsDbEmptyGuard(databaseService)).toBeDefined()
  })

  it('should return true if the database is empty', async () => {
    const isDbEmptyGuard = new IsDbEmptyGuard(databaseService)
    const res = await isDbEmptyGuard.canActivate()

    expect(res).toBe(true)
  })

  it('should return false if the database is not empty', async () => {
    jest
      .spyOn(databaseService, 'isDbEmpty')
      .mockReturnValue(Promise.resolve(false))

    const isDbEmptyGuard = new IsDbEmptyGuard(databaseService)
    const res = await isDbEmptyGuard.canActivate()

    expect(res).toBe(false)
  })
})
