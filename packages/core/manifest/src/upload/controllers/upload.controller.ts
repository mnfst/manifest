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
  async uploadFile(
    @UploadedFile() file: any,
    @Body('entity') entity: string,
    @Body('property') property: string
  ): Promise<{ path: string }> {
    return {
      path: await this.uploadService.storeFile({
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
  ): Promise<{ [key: string]: string }> {
    return this.uploadService.storeImage({
      image,
      entity,
      property
    })
  }
}
