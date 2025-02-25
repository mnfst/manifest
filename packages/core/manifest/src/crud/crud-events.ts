import { CrudEventName } from '@repo/types'
import { CollectionController } from './controllers/collection.controller'
import { SingleController } from './controllers/single.controller'

export const crudEvents: {
  name: CrudEventName
  relatedFunctions: (keyof CollectionController | keyof SingleController)[]
  moment: 'before' | 'after'
}[] = [
  {
    name: 'beforeCreate',
    relatedFunctions: ['store'],
    moment: 'before'
  },
  {
    name: 'afterCreate',
    relatedFunctions: ['store'],
    moment: 'after'
  },
  {
    name: 'beforeUpdate',
    relatedFunctions: ['put', 'patch'],
    moment: 'before'
  },
  {
    name: 'afterUpdate',
    relatedFunctions: ['put', 'patch'],
    moment: 'after'
  },
  {
    name: 'beforeDelete',
    relatedFunctions: ['delete'],
    moment: 'before'
  },
  {
    name: 'afterDelete',
    relatedFunctions: ['delete'],
    moment: 'after'
  }
]
