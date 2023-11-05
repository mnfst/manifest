import { Entity } from '../crud/decorators/entity.decorator'
import { AuthenticableEntity } from './authenticable-entity'

@Entity()
export class Admin extends AuthenticableEntity {}
