import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import * as mkdirp from 'mkdirp'
import * as sharp from 'sharp'
import { EntityMetadata } from 'typeorm'
import * as uniqId from 'uniqid'
import { ImageSize } from '../../../shared/interfaces/image-size.interface'
import { PropertyDescription } from '../../../shared/interfaces/property-description.interface'
import { EntityMetaService } from '../crud/services/entity-meta.service'

@Injectable()
export class ImageUploadService {
  storagePath: string
  packageRoot: string

  private readonly defaultSizes: ImageSize[] = [
    {
      name: 'thumbnail',
      width: 80,
      height: 80
    },
    {
      name: 'large',
      width: 800,
      height: 800
    }
  ]

  constructor(
    configService: ConfigService,
    private readonly entityMetaService: EntityMetaService
  ) {
    this.storagePath = configService.get('storageFolder')
    this.packageRoot = configService.get('packageRoot')
  }

  /**
   * Stores an image and returns its path.
   *
   * @param file - The image to store.
   * @param entitySlug - The slug of the entity to associate the image with.
   * @param propName - The name of the property to associate the image with.
   *
   * @returns an object containing the sizes and paths of the stored image.
   *
   */
  store(
    file: any,
    entitySlug: string,
    propName: string
  ): { [key: string]: string } {
    // Get image sizes from property options if available.
    const entity: EntityMetadata =
      this.entityMetaService.getEntityMetadata(entitySlug)
    const props: PropertyDescription[] =
      this.entityMetaService.getPropDescriptions(entity)

    const prop = props.find(
      (prop: PropertyDescription) => prop.propName === propName
    )
    const sizes: ImageSize[] = prop.options.sizes || this.defaultSizes

    // CamelCase to kebab-case.
    const kebabCaseEntityName = entitySlug
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()

    // Create custom path. Ex: "posts/Jan19/23/4n5pxq24kp3iob12og9"
    const dateString =
      new Date().toLocaleString('en-us', { month: 'short' }) +
      new Date().getFullYear()
    const folder = `/${kebabCaseEntityName}/${dateString}`
    mkdirp.sync(`${this.storagePath}${folder}`)

    const name: string = uniqId()

    // Iterate through image sizes.
    sizes.forEach((size: ImageSize) => {
      const path = `${folder}/${name}-${size.name}.jpg`
      sharp(file.buffer)
        .jpeg({ quality: 80 })
        .resize(size.width, size.height, size.options)
        .toFile(
          `${this.storagePath}/${path}`,
          (err: Error, info: sharp.OutputInfo) => {
            return path
          }
        )
    })

    return sizes.reduce((acc: { [key: string]: string }, size: ImageSize) => {
      acc[size.name] = `${folder}/${name}-${size.name}.jpg`

      return acc
    }, {})
  }

  /**
   * Adds a dummy image to the storage system.
   */
  addDummyImages(): void {
    const folder: string = `${this.storagePath}/dummy`

    mkdirp.sync(folder)

    for (let i = 1; i <= 5; i++) {
      fs.copyFileSync(
        this.packageRoot + `/assets/seed/dummy-image${i}-thumbnail.jpg`,
        folder + `/dummy-image${i}-thumbnail.jpg`
      )
      fs.copyFileSync(
        this.packageRoot + `/assets/seed/dummy-image${i}-large.jpg`,
        folder + `/dummy-image${i}-large.jpg`
      )
    }
  }
}
