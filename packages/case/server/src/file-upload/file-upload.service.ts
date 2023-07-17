import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import * as uniqid from 'uniqid'

@Injectable()
export class FileUploadService {
  storagePath: string
  distRoot: string

  constructor(configService: ConfigService) {
    this.storagePath = configService.get('storageFolder')
    this.distRoot = configService.get('distRoot')
  }

  /**
   * Stores a file and returns its path.
   *
   * @param file - The file to store.
   * @param propName - The slug of the entity to associate the file with.
   * @returns The path of the stored file.
   */
  store(file: any, propName: string): string {
    // CamelCase to kebab-case
    const kebabCaseEntityName = propName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()

    // Create custom path. Ex: "posts/Jan19/23/4n5pxq24kp3iob12og9"
    const dateString =
      new Date().toLocaleString('en-us', { month: 'short' }) +
      new Date().getFullYear()

    const folder = `${kebabCaseEntityName}/${dateString}`
    mkdirp.sync(`${this.storagePath}/${folder}`)

    const path: string = `/${folder}/${uniqid()}-${file.originalname}`

    fs.writeFileSync(`${this.storagePath}${path}`, file.buffer)

    return path
  }

  /**
   * Adds a dummy document to the storage system.
   */
  addDummyDocument(): void {
    const folder: string = `${this.storagePath}/dummy`

    mkdirp.sync(folder)
    fs.copyFileSync(
      this.distRoot + '/assets/seed/dummy-document.xlsx',
      folder + '/dummy-document.xlsx'
    )
  }
}
