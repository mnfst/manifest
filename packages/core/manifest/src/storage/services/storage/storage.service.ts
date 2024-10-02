import { Injectable } from '@nestjs/common'
import { kebabize } from '../../../../../helpers/src'
import { DEFAULT_IMAGE_SIZES, STORAGE_PATH } from '../../../constants'

import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import sharp from 'sharp'
import uniqid from 'uniqid'
import { ImageSizesObject } from '@repo/types'

@Injectable()
export class StorageService {
  constructor() {}

  /**
   * Store a file.
   *
   * @param entity The entity slug.
   * @param property The property name.
   * @param fileBuffer The file buffer.
   *
   * @returns The file path.
   *
   */
  store(entity: string, property: string, file: any): string {
    const folder: string = this.createUploadFolder(entity, property)

    const filePath: string = `${folder}/${uniqid()}-${file.originalname}`

    fs.writeFileSync(`${STORAGE_PATH}/${filePath}`, file.buffer)
    return filePath
  }

  /**
   *
   * Store an image
   *
   * @param entity The entity slug.
   * @param property The property name.
   * @param fileBuffer The file buffer.
   * @param sizes The image sizes.
   *
   * @returns The file path.
   */
  storeImage(
    entity: string,
    property: string,
    image: any,
    imageSizes: ImageSizesObject
  ): { [key: string]: string } {
    const folder: string = this.createUploadFolder(entity, property)

    const uniqueName: string = uniqid()

    const imagePaths: { [key: string]: string } = {}

    Object.keys(imageSizes || DEFAULT_IMAGE_SIZES).forEach(
      (sizeName: string) => {
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
      }
    )

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
  createUploadFolder(entity: string, property: string): string {
    const dateString: string =
      new Date().toLocaleString('en-us', { month: 'short' }) +
      new Date().getFullYear()

    const folder: string = `${kebabize(entity)}/${kebabize(property)}/${dateString}`

    mkdirp.sync(`${STORAGE_PATH}/${folder}`)

    return folder
  }
}
