import { AuthenticatableEntity } from '../../core-entities/authenticable-entity'
import { Entity } from '../../decorators/entity.decorator'

@Entity()
export class User extends AuthenticatableEntity {}
