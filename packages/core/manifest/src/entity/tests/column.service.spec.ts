import { Test, TestingModule } from '@nestjs/testing'
import { ColumnService } from '../services/column.service'
import { PropType } from '../../../../types/src'

describe('ColumnService', () => {
  let service: ColumnService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ColumnService]
    }).compile()

    service = module.get<ColumnService>(ColumnService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getColumnTypes', () => {
    it('should return the column types for sqlite', () => {
      const result = ColumnService.getColumnTypes('sqlite')

      expect(result).toBeDefined()

      Object.values(PropType).forEach((propType) => {
        expect(result[propType]).toBeDefined()
      })
    })

    it('should return the column types for postgres', () => {
      const result = ColumnService.getColumnTypes('postgres')

      expect(result).toBeDefined()

      Object.values(PropType).forEach((propType) => {
        expect(result[propType]).toBeDefined()
      })
    })

    it('should return the column types for mysql', () => {
      const result = ColumnService.getColumnTypes('mysql')

      expect(result).toBeDefined()

      Object.values(PropType).forEach((propType) => {
        expect(result[propType]).toBeDefined()
      })
    })
  })

  describe('getColumnType', () => {
    it('should return the column type for a specific PropType', () => {
      const result = ColumnService.getColumnType('sqlite', PropType.String)

      expect(result).toBeDefined()
    })
  })
})
