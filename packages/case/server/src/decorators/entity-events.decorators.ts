import {
  BeforeInsert as TypeORMBeforeInsert,
  AfterInsert as TypeORMAfterInsert,
  BeforeUpdate as TypeORMBeforeUpdate,
  AfterUpdate as TypeORMAfterUpdate,
  BeforeRemove as TypeORMBeforeRemove,
  AfterRemove as TypeORMAfterRemove
} from 'typeorm'

const isSeeder = process.argv[1].includes('seed')

/**
 * Property decorator for defining a method to be executed before an entity is inserted
 * @returns {PropertyDecorator} The property decorator
 */
export const BeforeInsert = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMBeforeInsert()(target, propertyKey)
    }
  }
}

/**
 * Property decorator for defining a method to be executed after an entity is inserted
 * @returns {PropertyDecorator} The property decorator
 */
export const AfterInsert = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMAfterInsert()(target, propertyKey)
    }
  }
}
/**
 * Property decorator for defining a method to be executed before an entity is updated
 * @returns {PropertyDecorator} The property decorator
 */
export const BeforeUpdate = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMBeforeUpdate()(target, propertyKey)
    }
  }
}
/**
 * Property decorator for defining a method to be executed after an entity is updated
 * @returns {PropertyDecorator} The property decorator
 */
export const AfterUpdate = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMAfterUpdate()(target, propertyKey)
    }
  }
}
/**
 * Property decorator for defining a method to be executed before an entity is removed
 * @returns {PropertyDecorator} The property decorator
 */
export const BeforeRemove = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMBeforeRemove()(target, propertyKey)
    }
  }
}
/**
 * Property decorator for defining a method to be executed after an entity is removed
 * @returns {PropertyDecorator} The property decorator
 */
export const AfterRemove = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMAfterRemove()(target, propertyKey)
    }
  }
}
