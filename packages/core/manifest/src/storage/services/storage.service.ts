import { HttpException, Injectable } from '@nestjs/common'
import { kebabize } from '@repo/common'
import { DEFAULT_IMAGE_SIZES, STORAGE_PATH } from '../../constants'

import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import * as mkdirp from 'mkdirp'
import uniqid from 'uniqid'
import { ImageSizesObject } from '@repo/types'
import slugify from 'slugify'
import { ConfigService } from '@nestjs/config'
import {
  PutObjectCommand,
  S3Client,
  ListObjectsV2Command
} from '@aws-sdk/client-s3'

@Injectable()
export class StorageService {
  private isS3Enabled: boolean = false
  private s3Client: S3Client
  private s3Endpoint: string
  private s3Bucket: string
  private s3Region: string
  private s3AccessKeyId: string
  private s3SecretAccessKey: string
  private s3provider: string
  private s3FolderPrefix: string
  constructor(private configService: ConfigService) {
    this.isS3Enabled = !!this.configService.get('storage.s3Bucket')
    this.s3Endpoint = this.configService.get('storage.s3Endpoint')
    this.s3Bucket = this.configService.get('storage.s3Bucket')
    this.s3Region = this.configService.get('storage.s3Region')
    this.s3AccessKeyId = this.configService.get('storage.s3AccessKeyId')
    this.s3SecretAccessKey = this.configService.get('storage.s3SecretAccessKey')
    this.s3provider = this.s3Endpoint?.includes('amazon')
      ? 'aws'
      : this.s3Endpoint?.includes('digitalocean')
        ? 'digitalocean'
        : 'other'
    this.s3FolderPrefix = this.configService.get('storage.s3FolderPrefix') || ''

    if (this.isS3Enabled) {
      this.s3Client = new S3Client({
        region: this.s3Region,
        endpoint: this.s3Endpoint,
        credentials: {
          accessKeyId: this.s3AccessKeyId,
          secretAccessKey: this.s3SecretAccessKey
        },
        forcePathStyle: false
      })
    }
  }

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
  store(
    entity: string,
    property: string,
    file: { buffer: Buffer; originalname: string }
  ): Promise<string> {
    const folder: string = this.createUploadFolder(entity, property)
    const filePath: string = `${folder}/${uniqid()}-${slugify(file.originalname)}`

    if (this.isS3Enabled) {
      return this.uploadToS3(filePath, file.buffer)
    } else {
      const publicFolderPath: string = path.resolve(
        this.configService.get('paths.publicFolder'),
        STORAGE_PATH,
        filePath
      )

      if (
        !publicFolderPath.startsWith(
          path.resolve(
            this.configService.get('paths.publicFolder'),
            STORAGE_PATH
          )
        )
      ) {
        throw new Error('Invalid file path')
      }

      fs.writeFileSync(publicFolderPath, file.buffer)
      return Promise.resolve(this.prependStorageUrl(filePath))
    }
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
  async storeImage(
    entity: string,
    property: string,
    image: { buffer: Buffer; originalname: string },
    imageSizes: ImageSizesObject
  ): Promise<{ [key: string]: string }> {
    const folder: string = this.createUploadFolder(entity, property)
    const uniqueName: string = uniqid()
    const imagePaths: { [key: string]: string } = {}

    for (const sizeName in imageSizes || DEFAULT_IMAGE_SIZES) {
      const imageExtension: string = path.extname(image.originalname)

      if (['.jpg', '.jpeg', '.png'].indexOf(imageExtension) === -1) {
        throw new HttpException(
          `Unsupported image format: ${imageExtension}`,
          400
        )
      }

      const imagePath: string = `${folder}/${uniqueName}-${sizeName}${imageExtension}`

      const resizedImageBuffer: Buffer = await sharp(image.buffer)
        .resize(imageSizes[sizeName].width, imageSizes[sizeName].height, {
          fit: imageSizes[sizeName].fit
        })
        .toBuffer()

      if (this.isS3Enabled) {
        imagePaths[sizeName] = await this.uploadToS3(
          imagePath,
          resizedImageBuffer
        )
      } else {
        const publicFolderPath: string = path.resolve(
          this.configService.get('paths.publicFolder'),
          STORAGE_PATH,
          imagePath
        )

        if (
          !publicFolderPath.startsWith(
            path.resolve(
              this.configService.get('paths.publicFolder'),
              STORAGE_PATH
            )
          )
        ) {
          throw new Error('Invalid image path')
        }
        fs.writeFileSync(publicFolderPath, resizedImageBuffer)
        imagePaths[sizeName] = this.prependStorageUrl(imagePath)
      }
    }

    return imagePaths
  }

  /**
   * Generate a folder path for the given entity and property and creates it if it doesn't exist (local storage only).
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

    // Create the folder on local storage if S3 is not enabled.
    if (!this.isS3Enabled) {
      mkdirp.sync(
        `${this.configService.get('paths.publicFolder')}/${STORAGE_PATH}/${folder}`
      )
    }

    return folder
  }

  /**
   * Prepends the storage absolute URL to the given value.
   *
   * @param value The value to prepend the storage URL to.
   * @returns The value with the storage URL prepended.
   */
  prependStorageUrl(value: string): string {
    return `${this.configService.get('baseUrl')}/${STORAGE_PATH}/${value}`
  }

  /**
   * Upload a file to a remote S3 storage.
   *
   * @param key The file path within the bucket.
   * @param buffer The file buffer.
   * @returns The S3 file URL.
   */
  async uploadToS3(key: string, buffer: Buffer): Promise<string> {
    const path: string = `${this.s3FolderPrefix}/${key}`

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: path,
        Body: buffer,
        ChecksumAlgorithm: undefined,
        ACL: this.s3provider === 'digitalocean' ? 'public-read' : undefined
      })
    )
    return `${this.s3Endpoint}/${this.s3Bucket}/${path}`
  }

  /**
   * List files in S3 bucket by folder prefix.
   *
   * @param folderPath The folder path to list files from (e.g., 'entity-name/property-name/').
   * @param maxKeys Maximum number of keys to return (default: 1000).
   * @returns Array of file objects with key, size, and lastModified.
   */
  async listFiles(
    folderPath: string = '',
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<{
    files: Array<{
      key: string
      size: number
      lastModified: Date
      url: string
    }>
    folders: Array<{
      prefix: string
      name: string
    }>
    count: number
    isTruncated: boolean
    nextContinuationToken?: string
  }> {
    if (!this.isS3Enabled) {
      throw new HttpException('S3 storage is not enabled', 400)
    }

    const prefix = this.s3FolderPrefix
      ? `${this.s3FolderPrefix}/${folderPath}`
      : folderPath

    console.log(
      'Listing S3 files with prefix:',
      prefix,
      maxKeys,
      continuationToken
    )

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.s3Bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        Delimiter: '/', // This limits results to the current folder level
        ContinuationToken: continuationToken
      })

      const response = await this.s3Client.send(command)

      return {
        files:
          response.Contents?.filter((item) => item.Key !== prefix) // Exclude the folder itself
            .map((item) => ({
              key: item.Key!.replace(this.s3FolderPrefix, ''),
              size: item.Size!,
              lastModified: item.LastModified!,
              url: `${this.s3Endpoint}/${this.s3Bucket}/${item.Key}`
            })) || [],
        folders:
          response.CommonPrefixes?.map((commonPrefix) => ({
            prefix: commonPrefix.Prefix!.replace(this.s3FolderPrefix, ''),
            name: commonPrefix.Prefix!.replace(prefix, '').replace(/\/$/, '')
          })) || [],
        count:
          (response.KeyCount || 0) + (response.CommonPrefixes?.length || 0),
        isTruncated: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken
      }
    } catch (error) {
      console.error('Error listing S3 files:', error)
      throw new HttpException(`Failed to list S3 files: ${error.message}`, 500)
    }
  }
}
