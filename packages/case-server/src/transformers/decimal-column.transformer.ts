import { ValueTransformer } from 'typeorm'

/*
 * Fix typeorm bug : MySQL "decimal" column type is converted to string.
  This transformer allows null values on "nullable decimal"
  https://github.com/typeorm/typeorm/issues/873
  Usage example (foo.entity.ts) :
   @Column('decimal', {
       precision: 10,
       scale: 2,
       transformer: new DecimalColumnTransformer()
     })
     amount: number
  */
export class DecimalColumnTransformer implements ValueTransformer {
  to(data?: number | null): number | null {
    if (!isNullOrUndefined(data)) {
      return data
    }
    return 0
  }

  from(data?: string | null): number | null {
    if (!isNullOrUndefined(data)) {
      const res = parseFloat(data)
      if (isNaN(res)) {
        return null
      } else {
        return res
      }
    }
    return null
  }
}

function isNullOrUndefined<T>(
  obj: T | null | undefined
): obj is null | undefined {
  return typeof obj === 'undefined' || obj === null
}
