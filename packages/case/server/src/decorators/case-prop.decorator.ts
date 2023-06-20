import { PropType } from '../dynamic-entity/prop-types/prop-type.enum'

export const CaseProp = (options: {
  seed: (index?: number) => any
  type: PropType
}): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    Reflect.defineMetadata(`${propertyKey}:seed`, options.seed, target)
    Reflect.defineMetadata(`${propertyKey}:type`, options.type, target)
  }
}
