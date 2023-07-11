import { faker } from '@faker-js/faker'
import { SHA3 } from 'crypto-js'

import { PropType } from '../../../shared/enums/prop-type.enum'
import { Prop } from '../decorators/case-prop.decorator'
import {
  BeforeInsert,
  BeforeUpdate
} from '../decorators/entity-events.decorators'
import { Entity } from '../decorators/entity.decorator'
import { CaseEntity } from './case.entity'
import { UpdateEvent } from 'typeorm'

@Entity({
  nameSingular: 'user',
  namePlural: 'users',
  slug: 'user',
  propIdentifier: 'name'
})
export class User extends CaseEntity {
  @Prop({
    seed: () => faker.person.firstName()
  })
  name: string

  @Prop({
    type: PropType.Email
  })
  email: string

  // TODO: Hide those 2 props from the client.
  @Prop({
    type: PropType.Password
  })
  password: string

  @Prop()
  token: string

  @BeforeInsert()
  beforeInsert() {
    this.password = SHA3(this.password).toString()
  }

  @BeforeUpdate()
  beforeUpdate() {
    // TODO: this always updates the password, even if it's not changed. Try using a subscriber instead to only update the password if it's changed => https://stackoverflow.com/questions/61442055/typeorm-using-transactions-in-listener-methods-beforeupdate
    if (this.password) {
      this.password = SHA3(this.password).toString()
    } else {
      console.log('no password change')
      delete this.password
    }
  }
}
