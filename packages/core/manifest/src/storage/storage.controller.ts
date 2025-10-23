import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
import { StorageService } from './services/storage.service'
import { StorageFile, StorageFolder } from '@repo/types'
import { FileInterceptor } from '@nestjs/platform-express'

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * List files in a folder.
   *
   * @param folderPath The folder path.
   * @param maxKeys Maximum number of keys to return.
   * @param continuationToken Token for pagination.
   *
   * @returns List of files and folders.
   */
  @Get()
  async listFiles(
    @Query('path') folderPath?: string,
    @Query('maxKeys') maxKeys?: string,
    @Query('continuationToken') continuationToken?: string
  ): Promise<{
    files: StorageFile[]
    folders: StorageFolder[]
    count: number
    isTruncated: boolean
    nextContinuationToken?: string
  }> {
    return this.storageService.listFiles(
      folderPath,
      maxKeys ? parseInt(maxKeys, 10) : undefined,
      continuationToken
    )
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Body('path') path: string
  ): Promise<{ url: string }> {
    return { url: await this.storageService.storeFileAtPath(file.buffer, path) }
  }
}
