import { faker } from '@faker-js/faker'
import { SHA3 } from 'crypto-js'
import { BaseEntity } from 'typeorm'
import { PropType } from '../../../shared/enums/prop-type.enum'
import {
  BeforeInsert,
  BeforeUpdate
} from '../decorators/entity-events.decorators'
import { Prop } from '../decorators/prop.decorator'

export class AuthenticatableEntity extends BaseEntity {
  @Prop({
    seed: () => faker.person.firstName()
  })
  name: string

  @Prop({
    type: PropType.Email,
    seed: (index: number) => 'user' + (index + 1) + '@case.app'
  })
  email: string

  @Prop({
    type: PropType.Password,
    options: {
      isHiddenInList: true,
      isHiddenInDetail: true
    },
    typeORMOptions: { select: false }
  })
  password: string

  @BeforeInsert()
  beforeInsert() {
    this.password = SHA3(this.password).toString()
  }

  @BeforeUpdate()
  beforeUpdate() {
    if (this.password) {
      this.password = SHA3(this.password).toString()
    } else {
      delete this.password
    }
  }
}
