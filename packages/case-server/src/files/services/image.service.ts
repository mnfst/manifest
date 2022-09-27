import { Injectable } from '@nestjs/common'
import * as mkdirp from 'mkdirp'
import * as sharp from 'sharp'
import * as uniqId from 'uniqid'
import { caseConstants } from '../../case.constants'

@Injectable()
export class ImageService {
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

    const name: string = uniqId()

    // Iterate through all entity image sizes
    Object.keys(caseConstants.imageSizes[entityName]).forEach((key: string) => {
      const path = `${folder}/${name}-${key}.jpg`
      sharp(file.buffer)
        .jpeg({ quality: 80 })
        .resize(
          caseConstants.imageSizes[entityName][key].width,
          caseConstants.imageSizes[entityName][key].height,
          {
            fit: caseConstants.imageSizes[entityName][key].fit
          }
        )
        .toFile(
          `${caseConstants.storagePath}/${path}`,
          (err: Error, info: sharp.OutputInfo) => {
            return path
          }
        )
    })
    return `${folder}/${name}`
  }
}
