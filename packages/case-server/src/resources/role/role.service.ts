import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  DataSource,
  DeleteResult,
  EntityTarget,
  Repository,
  UpdateResult
} from 'typeorm'

import { Paginator } from '../../interfaces/paginator.interface'
import { PaginationService } from '../../services/pagination.service'
import { CasePermission } from '../interfaces/case-permission.interface'
import { CaseRole } from '../interfaces/case-role.interface'
import { CreateUpdateRoleDto } from './dtos/create-update-role.dto'

@Injectable()
export class RoleService {
  roleRepository: Repository<CaseRole>

  constructor(
    @Inject('ROLE')
    private roleEntity: EntityTarget<CaseRole>,
    @Inject('PERMISSION')
    private permissionEntity: EntityTarget<CasePermission>,
    private readonly paginationService: PaginationService,
    @Inject('DATA_SOURCE')
    private dataSource: DataSource
  ) {
    this.roleRepository = this.dataSource.getRepository(roleEntity)
  }

  async index({
    page,
    withoutPagination
  }: {
    page?: string
    withoutPagination?: string
  }): Promise<Paginator<CaseRole> | CaseRole[]> {
    const query = this.roleRepository
      .createQueryBuilder('role')
      .loadRelationCountAndMap('role.childRelationCount', 'role.users')
      .orderBy('role.name', 'ASC')

    if (withoutPagination === 'true') {
      return query.getMany()
    }

    return this.paginationService.paginate({
      query,
      resultsPerPage: 40,
      currentPage: page ? parseInt(page, 10) : 1
    })
  }

  async show(id: number): Promise<CaseRole> {
    return this.roleRepository
      .createQueryBuilder('role')
      .where('role.id = :id', { id })
      .loadRelationCountAndMap('role.childRelationCount', 'role.users')
      .leftJoinAndSelect('role.permissions', 'permission')
      .getOneOrFail()
  }

  async store(roleDto: CreateUpdateRoleDto): Promise<CaseRole> {
    const role: CaseRole = await this.roleRepository.create(roleDto)

    if (roleDto.permissionIds && roleDto.permissionIds.length) {
      const permissions: CasePermission[] = await this.dataSource
        .getRepository(this.permissionEntity)
        .findByIds(roleDto.permissionIds)

      role.permissions = permissions
    }

    return this.roleRepository.save(role)
  }

  async update(
    id: number,
    roleDto: CreateUpdateRoleDto
  ): Promise<UpdateResult> {
    const oldRole: CaseRole = await this.roleRepository.findOneOrFail({
      where: {
        id: id
      },
      relations: {
        permissions: true
      }
    })

    const role: CaseRole = await this.roleRepository.create(roleDto)

    // Update relationships : Permissions
    await this.dataSource
      .createQueryBuilder()
      .relation(this.roleEntity, 'permissions')
      .of(id)
      .remove(oldRole.permissions.map((p: CasePermission) => p.id))

    if (roleDto.permissionIds && roleDto.permissionIds.length) {
      await this.dataSource
        .createQueryBuilder()
        .relation(this.roleEntity, 'permissions')
        .of(id)
        .add(roleDto.permissionIds)
    }

    return this.roleRepository.update(id, role)
  }

  async destroy(id: number): Promise<DeleteResult> {
    const role: CaseRole = await this.roleRepository.findOneByOrFail({ id })

    return this.roleRepository.delete(role.id)
  }
}
