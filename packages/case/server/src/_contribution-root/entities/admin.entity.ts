import { AuthenticableEntity } from '../../core-entities/authenticable-entity'
import { Entity } from '../../crud/decorators/entity.decorator'

@Entity({
  seedCount: 3
})
export class Admin extends AuthenticableEntity {}
