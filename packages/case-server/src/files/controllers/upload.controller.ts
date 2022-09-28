import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { FileService } from '../services/file.service'
import { ImageService } from '../services/image.service'

@Controller('upload')
export class UploadController {
  constructor(
    private readonly fileService: FileService,
    private readonly imageService: ImageService
  ) {}

  @Post('/file')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: any,
    @Body('resourceName') resourceName: string
  ): { path: string } {
    return { path: this.fileService.save(file, resourceName) }
  }

  @Post('/image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @UploadedFile() file: any,
    @Body('resourceName') resourceName: string
  ): { path: string } {
    return { path: this.imageService.save(file, resourceName) }
  }
}
