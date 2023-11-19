import { faker } from '@faker-js/faker'
import { SHA3 } from 'crypto-js'

import { IsEmail, IsNotEmpty } from 'class-validator'
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
  /**
 * User's name
 */
  @Prop({
    validators: [IsNotEmpty()],
    seed: () => faker.person.firstName()
  })
  name: string
  /**
    * User's email
    */
  @Prop({
    type: PropType.Email,
    validators: [IsNotEmpty(), IsEmail()],
    seed: (index: number) => 'user' + (index + 1) + '@case.app'
  })
  email: string
  /**
    * User's password
    */
  @Prop({
    type: PropType.Password,
    options: {
      isHiddenInList: true,
      isHiddenInDetail: true
    },
    typeORMOptions: { select: false }
  })
  password: string

  /**
   * Method to be executed before a user entity is inserted
   */
  @BeforeInsert()
  beforeInsert() {
    this.password = SHA3(this.password).toString()
  }

  /**
 * Method to be executed before a user entity is updated
 */
  @BeforeUpdate()
  beforeUpdate() {
    if (this.password) {
      this.password = SHA3(this.password).toString()
    } else {
      delete this.password
    }
  }
}
