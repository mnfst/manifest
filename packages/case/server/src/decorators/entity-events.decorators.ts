import {
  BeforeInsert as TypeORMBeforeInsert,
  AfterInsert as TypeORMAfterInsert,
  BeforeUpdate as TypeORMBeforeUpdate,
  AfterUpdate as TypeORMAfterUpdate,
  BeforeRemove as TypeORMBeforeRemove,
  AfterRemove as TypeORMAfterRemove
} from 'typeorm'

const isSeeder = process.argv[1].includes('seed')

export const BeforeInsert = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMBeforeInsert()(target, propertyKey)
    }
  }
}

export const AfterInsert = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMAfterInsert()(target, propertyKey)
    }
  }
}

export const BeforeUpdate = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMBeforeUpdate()(target, propertyKey)
    }
  }
}

export const AfterUpdate = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMAfterUpdate()(target, propertyKey)
    }
  }
}

export const BeforeRemove = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMBeforeRemove()(target, propertyKey)
    }
  }
}

export const AfterRemove = (): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    if (!isSeeder) {
      TypeORMAfterRemove()(target, propertyKey)
    }
  }
}
