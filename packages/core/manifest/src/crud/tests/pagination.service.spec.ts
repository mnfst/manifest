import { Test, TestingModule } from '@nestjs/testing'
import { PaginationService } from '../services/pagination.service'

describe('PaginationService', () => {
  let service: PaginationService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaginationService]
    }).compile()

    service = module.get<PaginationService>(PaginationService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should paginate a query', async () => {
    const query = {
      getCount: jest.fn().mockResolvedValue(10),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([])
    } as any

    const resultsPerPage = 5
    const currentPage = 1

    const result = await service.paginate({
      query,
      currentPage,
      resultsPerPage
    })

    expect(result).toEqual({
      data: [],
      currentPage,
      lastPage: 2,
      from: 1,
      to: 5,
      total: 10,
      perPage: 5
    })
  })
})
