import {
  ExcelService,
  PaginationService,
  Paginator
} from '@case-app/nest-library'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, UpdateResult } from 'typeorm'

import { CreateUpdate<%= classify(name) %>Dto } from '../dtos/create-update-<%= dasherize(name) %>.dto'
import { <%= classify(name) %> } from '../<%= dasherize(name) %>.entity'
import { <%= classify(name) %>Service } from '../<%= dasherize(name) %>.service'

describe('<%= classify(name) %>Service', () => {
  let <%= camelize(name) %>Service: <%= classify(name) %>Service
  let repositoryMock: MockType<Repository<<%= classify(name) %>>>

  const test<%= classify(name) %> = { id: 1, name: 'Test' }
  const test<%= classify(name) %>Dto: CreateUpdate<%= classify(name) %>Dto = {
    name: 'test <%= camelize(name) %>',
  }
  const createQueryBuilder: any = {
    select: () => createQueryBuilder,
    addSelect: () => createQueryBuilder,
    orderBy: () => createQueryBuilder,
    groupBy: () => createQueryBuilder,
    where: () => createQueryBuilder,
    andWhere: () => createQueryBuilder,
    leftJoinAndSelect: () => createQueryBuilder,
    getMany: () => [test<%= classify(name) %>],
    getOne: () => test<%= classify(name) %>
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <%= classify(name) %>Service,
        {
          provide: getRepositoryToken(<%= classify(name) %>),
          useFactory: repositoryMockFactory
        },
        {
          provide: PaginationService,
          useValue: {
            paginate: () => ({
              data: [test<%= classify(name) %>],
              currentPage: 1,
              lastPage: 1,
              from: 1,
              to: 1,
              total: 1,
              perPage: 1
            })
          }
        },
        {
          provide: ExcelService,
          useValue: {
            export: () => 'path-to-csv-file.csv'
          }
        }
      ]
    }).compile()
    <%= camelize(name) %>Service = module.get<<%= classify(name) %>Service>(<%= classify(name) %>Service)
    repositoryMock = module.get(getRepositoryToken(<%= classify(name) %>))
  })

  it('should list <%= camelize(name) %>s', async () => {
    expect.assertions(8)

    repositoryMock.createQueryBuilder?.mockImplementation(
      () => createQueryBuilder
    )

    const <%= camelize(name) %>Paginator: Paginator<<%= classify(name) %>> = (await <%= camelize(name) %>Service.index(
      {}
    )) as Paginator<<%= classify(name) %>>
    const <%= camelize(name) %>s: <%= classify(name) %>[] = (await <%= camelize(name) %>Service.index({
      withoutPagination: true
    })) as <%= classify(name) %>[]

    expect(Array.isArray(<%= camelize(name) %>s)).toBe(true)
    expect(<%= camelize(name) %>Paginator).toHaveProperty('currentPage')
    expect(<%= camelize(name) %>Paginator).toHaveProperty('lastPage')
    expect(<%= camelize(name) %>Paginator).toHaveProperty('from')
    expect(<%= camelize(name) %>Paginator).toHaveProperty('to')
    expect(<%= camelize(name) %>Paginator).toHaveProperty('total')
    expect(<%= camelize(name) %>Paginator).toHaveProperty('perPage')
    expect(Array.isArray(<%= camelize(name) %>Paginator.data)).toBe(true)
  })

  it('should show an <%= camelize(name) %>', async () => {
    expect.assertions(2)
    repositoryMock.findOneOrFail?.mockReturnValue(test<%= classify(name) %>)

    await expect(<%= camelize(name) %>Service.show(test<%= classify(name) %>.id)).resolves.toEqual(test<%= classify(name) %>)
    expect(repositoryMock.findOneOrFail).toHaveBeenCalledWith({
      where: { id: test<%= classify(name) %>.id }
    })
  })

  it('should store an <%= camelize(name) %>', async () => {
    const dummyId = 56

    repositoryMock.create?.mockReturnValue(test<%= classify(name) %>Dto)
    repositoryMock.save?.mockReturnValue(
      Object.assign(test<%= classify(name) %>Dto, { id: dummyId })
    )

    const stored<%= classify(name) %>: <%= classify(name) %> = await <%= camelize(name) %>Service.store(test<%= classify(name) %>Dto)

    expect(stored<%= classify(name) %>).toHaveProperty('id', dummyId)
  })

  it('should update an <%= camelize(name) %>', async () => {
    repositoryMock.createQueryBuilder?.mockImplementation(
      () => createQueryBuilder
    )
    repositoryMock.create?.mockReturnValue(test<%= classify(name) %>Dto)

    const updatedResult: UpdateResult = await <%= camelize(name) %>Service.update(1, test<%= classify(name) %>Dto)

    expect(repositoryMock.create).toHaveBeenCalled()
    expect(repositoryMock.update).toHaveBeenCalled()
  })

  it('should delete an <%= camelize(name) %>', async () => {
    expect.assertions(2)

    const mockDeleteResult = { raw: 'mock data delete result' }

    repositoryMock.delete?.mockReturnValue(mockDeleteResult)
    repositoryMock.findOneOrFail?.mockReturnValue(test<%= classify(name) %>)

    await expect(<%= camelize(name) %>Service.destroy(test<%= classify(name) %>.id)).resolves.toEqual(
      mockDeleteResult
    )
    expect(repositoryMock.delete).toHaveBeenCalledWith(test<%= classify(name) %>.id)
  })
})

// @ts-ignore
export const repositoryMockFactory: () => MockType<Repository<any>> = jest.fn(
  () => ({
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    update: jest.fn()
  })
)

export type MockType<T> = {
  [P in keyof T]?: jest.Mock<{}>
}
