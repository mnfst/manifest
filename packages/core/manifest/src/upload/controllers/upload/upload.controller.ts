import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { StorageService } from '../../services/storage.service'

@Controller('upload')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('/file')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: any,
    @Body('entity') entity: string,
    @Body('property') property: string
  ): { path: string } {
    return {
      path: this.storageService.storeFile({
        file,
        entity,
        property
      })
    }
  }

  // @Post('/image')
  // @UseInterceptors(FileInterceptor('file'))
  // uploadImage(
  //   @UploadedFile() file: any,
  //   @Body('resourceName') resourceName: string
  // ): { path: string } {
  //   return { path: this.storageService.storeImage(file, resourceName) }
  // }
}
