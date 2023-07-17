import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import { join } from 'path'
import * as uniqid from 'uniqid'

@Injectable()
export class FileUploadService {
  /**
   * Stores a file and returns its path.
   *
   * @param file - The file to store.
   * @param propName - The slug of the entity to associate the file with.
   * @returns The path of the stored file.
   */
  store(file: any, propName: string): string {
    const contributionMode: boolean = process.argv[2] === 'contribution'

    // CamelCase to kebab-case
    const kebabCaseEntityName = propName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()

    // Create custom path. Ex: "posts/Jan19/23/4n5pxq24kp3iob12og9"
    const dateString =
      new Date().toLocaleString('en-us', { month: 'short' }) +
      new Date().getFullYear()

    const storagePath: string = contributionMode
      ? join(__dirname, '../../../_contribution-root/public/storage')
      : join(__dirname, '../../public/storage')

    console.log(storagePath)

    const folder = `${kebabCaseEntityName}/${dateString}`
    mkdirp.sync(`${storagePath}/${folder}`)

    const path: string = `/${folder}/${uniqid()}-${file.originalname}`

    fs.writeFileSync(`${storagePath}${path}`, file.buffer)

    return path
  }
}
