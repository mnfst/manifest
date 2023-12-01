import {
  AfterInsert as TypeORMAfterInsert,
  AfterRemove as TypeORMAfterRemove,
  AfterUpdate as TypeORMAfterUpdate,
  BeforeInsert as TypeORMBeforeInsert,
  BeforeRemove as TypeORMBeforeRemove,
  BeforeUpdate as TypeORMBeforeUpdate
} from 'typeorm'

// Hooks are not executed when seeding the database.
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
