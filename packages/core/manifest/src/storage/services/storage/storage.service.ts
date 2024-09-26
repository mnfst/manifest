import { Injectable } from '@nestjs/common'
import { kebabize } from '../../../../../helpers/src'
import { STORAGE_PATH } from '../../../constants'

import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import uniqid from 'uniqid'

@Injectable()
export class StorageService {
  constructor() {}

  /**
   * Store a file.
   *
   * @param filePath The file path including the folder and complete file name.
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
