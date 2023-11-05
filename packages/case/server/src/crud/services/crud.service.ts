import { Injectable, NotFoundException } from '@nestjs/common'
import {
  DeleteResult,
  FindManyOptions,
  FindOptionsWhere,
  In,
  Repository
} from 'typeorm'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'

import { Paginator } from '../../../../shared/interfaces/paginator.interface'
import { SelectOption } from '../../../../shared/interfaces/select-option.interface'
import { EntityMetaService } from './entity-meta.service'

@Injectable()
export class CrudService {
  constructor(private entityMetaService: EntityMetaService) {}

  async findAll({
    entitySlug,
    queryParams,
    options
  }: {
    entitySlug: string
    queryParams?: { [key: string]: string | string[] }
    options?: { paginated?: boolean }
  }): Promise<Paginator<any> | any[]> {
    const entityRepository: Repository<any> =
      this.entityMetaService.getRepository(entitySlug)

    // Get entity relations.
    const relations: string[] = this.entityMetaService
      .getEntityMetadata(entitySlug)
      .relations.map((relation: RelationMetadata) => relation.propertyName)

    // Dynamic filtering.
    const where: FindOptionsWhere<any> = {}

    Object.keys(queryParams || {}).forEach((key: string) => {
      // Check if key is a relation.
      if (relations.includes(key)) {
        // Force array.
        if (typeof queryParams[key] === 'string') {
          queryParams[key] = [queryParams[key] as string]
        }
        // Add relation where clause: { relation: In([1, 2, 3])  }
        where[key] = In(queryParams[key] as string[])
      }
    })

    const findManyOptions: FindManyOptions<any> = {
      order: { id: 'DESC' },
      relations,
      where
    }

    // Non paginated results.
    if (!options?.paginated) {
      return await entityRepository.find(findManyOptions)
    }

    // Paginated results.
    const currentPage: number = parseInt(queryParams.page as string, 10) || 1

    findManyOptions.take = 10
    findManyOptions.skip = (currentPage - 1) * findManyOptions.take

    const total: number = await entityRepository.count(findManyOptions)
    const results: any[] = await entityRepository.find(findManyOptions)

    const paginator: Paginator<any> = {
      data: results,
      currentPage,
      lastPage: Math.ceil(total / findManyOptions.take),
      from: findManyOptions.skip + 1,
      to: findManyOptions.skip + findManyOptions.take,
      total,
      perPage: findManyOptions.take
    }

    return paginator
  }

  async findSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    const items: any[] = (await this.findAll({
      entitySlug
    })) as any[]

    return items.map((item: any) => ({
      id: item.id,
      label:
        item[
          (this.entityMetaService.getEntityMetadata(entitySlug).target as any)
            .definition.propIdentifier
        ]
    }))
  }

  async findOne(entitySlug: string, id: number) {
    const item = await this.entityMetaService
      .getRepository(entitySlug)
      .findOne({
        where: { id },
        relations: this.entityMetaService
          .getEntityMetadata(entitySlug)
          .relations.map((relation: RelationMetadata) => relation.propertyName)
      })

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  async store(entitySlug: string, entityDto: any) {
    const entityRepository: Repository<any> =
      this.entityMetaService.getRepository(entitySlug)

    const newEntity = entityRepository.create(entityDto)

    const relations: RelationMetadata[] =
      this.entityMetaService.getEntityMetadata(entitySlug).relations

    // If we have relations, we load them to be available in the @BeforeInsert() hook.
    if (relations.length) {
      newEntity._relations = await this.entityMetaService.loadRelations(
        newEntity,
        relations
      )
    }

    return entityRepository.insert(newEntity)
  }

  async update(entitySlug: string, id: number, entityDto: any) {
    const entityRepository: Repository<any> =
      this.entityMetaService.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    const entityToSave = entityRepository.create({
      ...item,
      ...entityDto
    })

    return entityRepository.save(entityToSave)
  }

  async delete(entitySlug: string, id: number): Promise<DeleteResult> {
    const entityRepository: Repository<any> =
      this.entityMetaService.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.delete(id)
  }
}
