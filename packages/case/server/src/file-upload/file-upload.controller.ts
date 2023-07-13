import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import { FileUploadService } from './file-upload.service'
import { ImageUploadService } from './image-upload.service'

@Controller('upload')
export class FileUploadController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly imageUploadService: ImageUploadService
  ) {}

  @Post('/file')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: any,
    @Body('propName') propName: string
  ): { path: string } {
    return { path: this.fileUploadService.store(file, propName) }
  }

  @Post('/image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @UploadedFile() file: any,
    @Body('propName') propName: string
  ): { path: string } {
    return { path: this.imageUploadService.store(file, propName) }
  }
}
