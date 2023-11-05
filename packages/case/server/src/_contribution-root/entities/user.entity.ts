import { AuthenticableEntity } from '../../core-entities/authenticable-entity'
import { Entity } from '../../crud/decorators/entity.decorator'

@Entity()
export class User extends AuthenticableEntity {}
