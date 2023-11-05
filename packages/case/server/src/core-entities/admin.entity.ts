import { Entity } from '../crud/decorators/entity.decorator'
import { AuthenticableEntity } from './authenticable-entity'

@Entity({
  seedCount: 1
})
export class Admin extends AuthenticableEntity {}
