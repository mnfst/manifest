import { HookEventName } from '@repo/types'
import { CollectionController } from '../crud/controllers/collection.controller'
import { SingleController } from '../crud/controllers/single.controller'

export const hookEvents: {
  name: HookEventName
  relatedFunction: keyof CollectionController | keyof SingleController
  moment: 'before' | 'after'
}[] = [
  {
    name: 'beforeCreate',
    relatedFunction: 'store',
    moment: 'before'
  },
  {
    name: 'afterCreate',
    relatedFunction: 'store',
    moment: 'after'
  },
  {
    name: 'beforeUpdate',
    relatedFunction: 'update',
    moment: 'before'
  },
  {
    name: 'afterUpdate',
    relatedFunction: 'update',
    moment: 'after'
  },
  {
    name: 'beforeDelete',
    relatedFunction: 'delete',
    moment: 'before'
  },
  {
    name: 'afterDelete',
    relatedFunction: 'delete',
    moment: 'after'
  }
]
