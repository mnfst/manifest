import { Entity } from '../decorators/entity.decorator'
import { AuthenticatableEntity } from './authenticable-entity'

@Entity()
export class Admin extends AuthenticatableEntity {}
