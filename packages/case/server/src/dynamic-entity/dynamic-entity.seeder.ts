import { Injectable } from '@nestjs/common'
import * as BluebirdPromise from 'bluebird'
import { DataSource, EntityMetadata, Repository } from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'

import { PropType } from '../../../shared/enums/prop-type.enum'
import { EntityDefinition } from '../../../shared/interfaces/entity-definition.interface'
import e from 'express'

@Injectable()
export class DynamicEntitySeeder {
  defaultSeedCount = 10

  constructor(private dataSource: DataSource) {}

  async seed() {
    const entities: EntityMetadata[] = this.orderEntities(
      this.dataSource.entityMetadatas
    )

    const queryRunner = this.dataSource.createQueryRunner()

    await queryRunner.query('PRAGMA foreign_keys = OFF')

    await Promise.all(
      entities.map(async (entity: EntityMetadata) =>
        queryRunner
          .query(`DELETE FROM ${entity.tableName}`)
          .then(() =>
            queryRunner.query(
              `DELETE FROM sqlite_sequence WHERE name = '${entity.tableName}'`
            )
          )
      )
    )

    await queryRunner.query('PRAGMA foreign_keys = ON')

    console.log('\x1b[35m', '[x] Removed all existing data...')

    return BluebirdPromise.map(
      entities,
      (entity: EntityMetadata) => {
        const definition: EntityDefinition = (entity.target as any).definition

        const entityRepository: Repository<any> = this.getRepository(
          entity.tableName
        )

        const seedCount: number = definition.seedCount || this.defaultSeedCount

        console.log(
          '\x1b[35m',
          `[x] Seeding ${seedCount} ${definition.namePlural}...`
        )

        return BluebirdPromise.map(
          Array.from({
            length: seedCount
          }),
          (_, index) => {
            console.log(index)

            const newItem = entityRepository.create()

            entity.columns.forEach((column: ColumnMetadata) => {
              if (column.propertyName === 'id') {
                return
              }

              const propSeederFn: (
                index?: number,
                relationSeedCount?: number
              ) => any = Reflect.getMetadata(
                `${column.propertyName}:seed`,
                newItem
              )

              const propType: PropType = Reflect.getMetadata(
                `${column.propertyName}:type`,
                newItem
              )

              if (propType === PropType.Relation) {
                const relatedEntity = Reflect.getMetadata(
                  `${column.propertyName}:settings`,
                  newItem
                )?.entity

                newItem[`${column.propertyName}`] = propSeederFn(
                  index,
                  relatedEntity.definition.seedCount || this.defaultSeedCount
                )
              } else {
                newItem[column.propertyName] = propSeederFn(index)
              }
            })

            return entityRepository.save(newItem)
          },
          { concurrency: 1 }
        )
      },
      { concurrency: 1 }
    )
  }

  private getRepository(entityTableName: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) => entity.tableName === entityTableName
    )

    if (!entity) {
      throw new Error('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }

  private orderEntities(entities: EntityMetadata[]): EntityMetadata[] {
    const orderedEntities: EntityMetadata[] = []

    entities.forEach((entity: EntityMetadata) => {
      const relationColumns: ColumnMetadata[] = entity.columns.filter(
        (column: ColumnMetadata) => column.relationMetadata
      )

      if (!relationColumns.length) {
        orderedEntities.push(entity)
      } else {
        relationColumns.forEach((relationColumn: ColumnMetadata) => {
          const relatedEntity: EntityMetadata =
            relationColumn.relationMetadata.entityMetadata

          if (orderedEntities.includes(relatedEntity)) {
            orderedEntities.splice(
              orderedEntities.indexOf(relatedEntity),
              0,
              entity
            )
          } else {
            orderedEntities.push(entity)
          }
        })
      }
    })

    return orderedEntities
  }
}
