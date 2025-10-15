import { Controller, Get, Query } from '@nestjs/common'
import { StorageService } from './services/storage.service'
import { StorageFile, StorageFolder } from '@repo/types'

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
}
