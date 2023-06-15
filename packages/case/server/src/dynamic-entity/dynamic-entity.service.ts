import { Injectable, NotFoundException } from '@nestjs/common'
import { DataSource, EntityMetadata, Repository } from 'typeorm'

@Injectable()
export class DynamicEntityService {
  constructor(private dataSource: DataSource) {}

  findAll(entityTableName: string) {
    return this.getRepository(entityTableName).find({
      order: { id: 'DESC' }
    })
  }

  async findOne(entityTableName: string, id: number) {
    const item = await this.getRepository(entityTableName).findOne({
      where: { id }
    })

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  async store(entityTableName: string, entityDto: any) {
    const entityRepository: Repository<any> =
      this.getRepository(entityTableName)

    const item = entityRepository.create(entityDto)

    return entityRepository.insert(item)
  }

  async update(entityTableName: string, id: number, entityDto: any) {
    const entityRepository: Repository<any> =
      this.getRepository(entityTableName)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.update(id, entityDto)
  }

  async delete(entityTableName: string, id: number) {
    const entityRepository: Repository<any> =
      this.getRepository(entityTableName)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.delete(id)
  }

  private getRepository(entityTableName: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) => entity.tableName === entityTableName
    )

    if (!entity) {
      throw new NotFoundException('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }
}
