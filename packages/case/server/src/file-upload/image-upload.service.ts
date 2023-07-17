import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as mkdirp from 'mkdirp'
import * as sharp from 'sharp'
import * as uniqId from 'uniqid'

@Injectable()
export class ImageUploadService {
  private readonly imageSizes = {
    thumbnail: {
      width: 80,
      height: 80
    },
    large: {
      width: 800,
      height: 800
    }
  }

  constructor(private readonly configService: ConfigService) {}

  store(file: any, propName: string): string {
    // CamelCase to kebab-case.
    const kebabCaseEntityName = propName
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()

    const storagePath: string = this.configService.get('storageFolder')

    // Create custom path. Ex: "posts/Jan19/23/4n5pxq24kp3iob12og9"
    const dateString =
      new Date().toLocaleString('en-us', { month: 'short' }) +
      new Date().getFullYear()
    const folder = `${kebabCaseEntityName}/${dateString}`
    mkdirp.sync(`${storagePath}/${folder}`)

    const name: string = uniqId()

    // Iterate through image sizes.
    Object.keys(this.imageSizes).forEach((key: string) => {
      const path = `${folder}/${name}-${key}.jpg`
      sharp(file.buffer)
        .jpeg({ quality: 80 })
        .resize(this.imageSizes[key].width, this.imageSizes[key].height, {
          fit: this.imageSizes[key].fit
        })
        .toFile(
          `${storagePath}/${path}`,
          (err: Error, info: sharp.OutputInfo) => {
            return path
          }
        )
    })
    return `/${folder}/${name}`
  }
}
