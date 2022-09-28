import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import * as uniqId from 'uniqid'
import { caseConstants } from '../../case.constants'

@Injectable()
export class FileService {
  save(file: any, entityName: string): string {
    // CamelCase to kebab-case
    const kebabCaseEntityName = entityName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()

    // Create custom path. Ex: "posts/Jan19/23/4n5pxq24kp3iob12og9"
    const dateString =
      new Date().toLocaleString('en-us', { month: 'short' }) +
      new Date().getFullYear()
    const folder = `${kebabCaseEntityName}/${dateString}`
    mkdirp.sync(`${caseConstants.storagePath}/${folder}`)

    const path: string = `${folder}/${uniqId()}-${file.originalname}`

    fs.writeFileSync(`${caseConstants.storagePath}/${path}`, file.buffer)

    return path
  }
}
