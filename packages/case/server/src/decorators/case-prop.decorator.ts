import { PropType } from '../dynamic-entity/prop-types/prop-type.enum'
import { Column } from 'typeorm'

export const CaseProp = (options: {
  seed: (index?: number) => any
  type: PropType
}): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    // Extend the Column decorator from TypeORM.
    Column()(target, propertyKey)

    Reflect.defineMetadata(`${propertyKey}:seed`, options.seed, target)
    Reflect.defineMetadata(`${propertyKey}:type`, options.type, target)
  }
}
