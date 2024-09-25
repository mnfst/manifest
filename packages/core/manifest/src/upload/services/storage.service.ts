import { HttpException, Injectable } from '@nestjs/common'
import { kebabize } from '../../../../helpers/src'
import { STORAGE_PATH } from '../../constants'

import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import * as uniqid from 'uniqid'

@Injectable()
export class StorageService {
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

    fs.writeFileSync(filePath, file.buffer)

    return filePath
  }

  storeImage() {}

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

    const folder: string = `${STORAGE_PATH}/${kebabize(entity)}/${kebabize(property)}/${dateString}`

    mkdirp.sync(folder)

    return folder
  }
}
