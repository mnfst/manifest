import { BooleanTransformer } from '../transformers/boolean-transformer'
import { NumberTransformer } from '../transformers/number-transformer'
import { TimestampTransformer } from '../transformers/timestamp-transformer'

describe('Transformers', () => {
  describe('BooleanTransformer', () => {
    it('should convert boolean to number for MySQL', () => {
      const connection = 'mysql'
      const transformer = new BooleanTransformer(connection)
      const value = true
      const result = transformer.to(value)
      expect(result).toBe(1)
    })

    it('should convert number to boolean for MySQL', () => {
      const connection = 'mysql'
      const transformer = new BooleanTransformer(connection)
      const value = 1
      const result = transformer.from(value)
      expect(result).toBe(true)
    })
  })

  describe('NumberTransformer', () => {
    it('should always return a number', () => {
      const transformer = new NumberTransformer()
      const value = '1'
      const result = transformer.from(value)
      expect(result).toBe(1)
    })
  })

  describe('TimestampTransformer', () => {
    it('should always return a string', () => {
      const transformer = new TimestampTransformer()
      const value = new Date()
      const fromResult = transformer.from(value)
      const toResult = transformer.to(new Date().toDateString())

      expect(typeof fromResult).toBe('string')
      expect(typeof toResult).toBe('string')
    })
  })
})
