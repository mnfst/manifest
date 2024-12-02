import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from '../services/upload.service'

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('/file')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: any,
    @Body('entity') entity: string,
    @Body('property') property: string
  ): { path: string } {
    return {
      path: this.uploadService.storeFile({
        file,
        entity,
        property
      })
    }
  }

  @Post('/image')
  @UseInterceptors(FileInterceptor('image'))
  uploadImage(
    @UploadedFile() image: any,
    @Body('entity') entity: string,
    @Body('property') property: string
  ): { [key: string]: string } {
    return this.uploadService.storeImage({
      image,
      entity,
      property
    })
  }
}
