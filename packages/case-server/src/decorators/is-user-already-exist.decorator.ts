import { Inject, Injectable } from '@nestjs/common'
import {
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator'
import { DataSource, EntityTarget } from 'typeorm'

import { CaseUser } from '../resources/interfaces/case-user.interface'

@ValidatorConstraint({ name: 'isUserAlreadyExist', async: true })
@Injectable()
export class IsUserAlreadyExist implements ValidatorConstraintInterface {
  constructor(
    @Inject('USER') private UserEntity: EntityTarget<CaseUser>,
    private dataSource: DataSource
  ) {}

  async validate(email: string): Promise<boolean> {
    const user: CaseUser = await this.dataSource
      .getRepository(this.UserEntity)
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne()

    return !user
  }

  defaultMessage() {
    return 'Erreur : Un utilisateur avec le même e-mail est déjà présent en base de données.'
  }
}
