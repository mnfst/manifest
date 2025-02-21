import { HttpException, Injectable } from '@nestjs/common'

import { EntityManifest, ImageSizesObject, PropertyManifest } from '@repo/types'

import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { StorageService } from '../../storage/services/storage.service'

@Injectable()
export class UploadService {
  constructor(
    private readonly storageService: StorageService,
    private readonly entityManifestService: EntityManifestService
  ) {}

  /**
   * Store a file.
   *
   * @param file The file to store.
   * @param entity The entity name.
   * @param property The property name.
   *
   * @returns The file path.
   */
  storeFile({
    file,
    entity,
    property
  }: {
    file: { buffer: Buffer; originalname: string }
    entity: string
    property: string
  }): Promise<string> {
    if (!file) {
      throw new HttpException('File should be provided', 400)
    }

    if (!entity || !property) {
      throw new HttpException(
        'Entity name and property should be provided',
        400
      )
    }

    return this.storageService.store(entity, property, file)
  }

  storeImage({
    image,
    entity,
    property
  }: {
    image: { buffer: Buffer; originalname: string }
    entity: string
    property: string
  }): Promise<{ [key: string]: string }> {
    if (!image) {
      throw new HttpException('Image should be provided', 400)
    }

    if (!entity || !property) {
      throw new HttpException(
        'Entity name and property should be provided',
        400
      )
    }

    const entityManifest: EntityManifest =
      this.entityManifestService.getEntityManifest({
        slug: entity
      })

    const propertyManifest: PropertyManifest = entityManifest.properties.find(
      (prop: PropertyManifest) => prop.name === property
    )

    if (!propertyManifest) {
      throw new HttpException(
        `Property ${property} does not exist on entity ${entity}`,
        400
      )
    }

    if (propertyManifest.type !== 'image') {
      throw new HttpException(
        `Property ${property} is not an image property`,
        400
      )
    }

    return this.storageService.storeImage(
      entity,
      property,
      image,
      propertyManifest.options.sizes as ImageSizesObject
    )
  }
}
