import { Injectable, NotFoundException } from '@nestjs/common'
import {
  DataSource,
  EntityMetadata,
  FindManyOptions,
  FindOptionsWhere,
  In,
  Repository
} from 'typeorm'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'
import { SelectOption } from '../../../shared/interfaces/select-option.interface'
import { Paginator } from '../../../shared/interfaces/paginator.interface'
import { find } from 'rxjs'

@Injectable()
export class DynamicEntityService {
  constructor(private dataSource: DataSource) {}

  async findAll({
    entitySlug,
    queryParams,
    options
  }: {
    entitySlug: string
    queryParams?: { [key: string]: string | string[] }
    options?: { paginated?: boolean }
  }): Promise<Paginator<any> | any[]> {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    // Get entity relations
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    const relations: string[] = entity.relations.map(
      (relation: RelationMetadata) => relation.propertyName
    )

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

    // Get entity propIdentifier.
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    return items.map((item: any) => ({
      id: item.id,
      label: item[(entity.target as any).definition.propIdentifier]
    }))
  }

  async findOne(entitySlug: string, id: number) {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    const item = await this.getRepository(entitySlug).findOne({
      where: { id },
      relations: entity.relations.map(
        (relation: RelationMetadata) => relation.propertyName
      )
    })

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  async store(entitySlug: string, entityDto: any) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    return entityRepository.insert(entityRepository.create(entityDto))
  }

  async update(entitySlug: string, id: number, entityDto: any) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

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

  async delete(entitySlug: string, id: number) {
    const entityRepository: Repository<any> = this.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.delete(id)
  }

  private getRepository(entitySlug: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) =>
        (entity.target as any).definition.slug === entitySlug
    )

    if (!entity) {
      throw new NotFoundException('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }
}
