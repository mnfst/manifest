import { faker } from '@faker-js/faker'
import { SHA3 } from 'crypto-js'
import { Column } from 'typeorm'

import { PropType } from '../../../shared/enums/prop-type.enum'
import {
  BeforeInsert,
  BeforeUpdate
} from '../decorators/entity-events.decorators'
import { Entity } from '../decorators/entity.decorator'
import { Prop } from '../decorators/prop.decorator'
import { CaseEntity } from './case.entity'

@Entity({
  nameSingular: 'user',
  namePlural: 'users',
  slug: 'users',
  propIdentifier: 'name'
})
export class User extends CaseEntity {
  @Prop({
    seed: () => faker.person.firstName()
  })
  name: string

  @Prop({
    type: PropType.Email,
    seed: (index) => 'user' + index + '@case.app'
  })
  email: string

  @Prop({
    type: PropType.Password,
    seed: () => SHA3('case').toString(),
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
