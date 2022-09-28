import { Inject, Injectable } from '@nestjs/common'
import { DataSource, EntityTarget, Repository } from 'typeorm'

import { CasePermission } from '../interfaces/case-permission.interface'

@Injectable()
export class PermissionService {
  permissionRepository: Repository<CasePermission>

  constructor(
    @Inject('PERMISSION')
    permissionEntity: EntityTarget<CasePermission>,
    @Inject('DATA_SOURCE')
    dataSource: DataSource
  ) {
    this.permissionRepository = dataSource.getRepository(permissionEntity)
  }

  index(): Promise<CasePermission[]> {
    return this.permissionRepository.createQueryBuilder('permission').getMany()
  }
}
