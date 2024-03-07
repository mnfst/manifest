import { PrimaryGeneratedColumn } from 'typeorm'
import { PropType } from '../../../shared/enums/prop-type.enum'
import { Prop } from '../crud/decorators/prop.decorator'

// The base entity is used to extend all entities in the application.
export class BaseEntity {
  @Prop({
    type: PropType.Number,
    options: {
      isHiddenInAdminCreateEdit: true
    }
  })
  @PrimaryGeneratedColumn()
  id: number
}
