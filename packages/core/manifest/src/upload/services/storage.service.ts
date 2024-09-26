import { HttpException, Injectable } from '@nestjs/common'
import { kebabize } from '../../../../helpers/src'
import { DEFAULT_IMAGE_SIZES, STORAGE_PATH } from '../../constants'

import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import uniqid from 'uniqid'
import sharp from 'sharp'
import { EntityManifest, ImageSizesObject, PropertyManifest } from '@repo/types'
import { ManifestService } from '../../manifest/services/manifest.service'

@Injectable()
export class StorageService {
  constructor(private readonly manifestService: ManifestService) {}

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
    file: any
    entity: string
    property: string
  }): string {
    if (!file) {
      throw new HttpException('File should be provided', 400)
    }

    if (!entity || !property) {
      throw new HttpException(
        'Entity name and property should be provided',
        400
      )
    }

    const folder: string = this.createUploadFolder(entity, property)

    const filePath: string = `${folder}/${uniqid()}-${file.originalname}`

    fs.writeFileSync(`${STORAGE_PATH}/${filePath}`, file.buffer)

    return filePath
  }

  storeImage({
    image,
    entity,
    property
  }: {
    image: any
    entity: string
    property: string
  }): { [key: string]: string } {
    if (!image) {
      throw new HttpException('Image should be provided', 400)
    }

    if (!entity || !property) {
      throw new HttpException(
        'Entity name and property should be provided',
        400
      )
    }

    const folder: string = this.createUploadFolder(entity, property)
    const uniqueName: string = uniqid()

    // Get custom image sizes.
    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({
        slug: entity
      })

    const propertyManifest: PropertyManifest = entityManifest?.properties.find(
      (prop) => prop.name === property
    )

    if (!propertyManifest) {
      throw new HttpException('Entity or property not found', 400)
    }

    const imageSizes: ImageSizesObject =
      (propertyManifest.options.sizes as ImageSizesObject) ||
      DEFAULT_IMAGE_SIZES

    const imagePaths: { [key: string]: string } = {}

    Object.keys(imageSizes).forEach((sizeName: string) => {
      const imagePath: string = `${folder}/${uniqueName}-${sizeName}.jpg`

      sharp(image.buffer)
        .jpeg({ quality: 80 })
        .resize(imageSizes[sizeName].width, imageSizes[sizeName].height, {
          fit: imageSizes[sizeName].fit
        })
        .toFile(`${STORAGE_PATH}/${imagePath}`, () => {
          return imagePath
        })

      imagePaths[sizeName] = imagePath
    })

    return imagePaths
  }

  /**
   * Create the upload folder if it doesn't exist.
   *
   * @param entity The entity name.
   * @param property The property name.
   *
   * @returns The folder path.
   */
  private createUploadFolder(entity: string, property: string): string {
    const dateString: string =
      new Date().toLocaleString('en-us', { month: 'short' }) +
      new Date().getFullYear()

    const folder: string = `${kebabize(entity)}/${kebabize(property)}/${dateString}`

    mkdirp.sync(`${STORAGE_PATH}/${folder}`)

    return folder
  }
}
