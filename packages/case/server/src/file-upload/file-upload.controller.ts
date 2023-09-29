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

/**
 * Controller for file uploads
 * @class FileUploadController
 */
@Controller('upload')
export class FileUploadController {
  /**
   * Constructor for the FileUploadController class
   * @param {FileUploadService} fileUploadService - Service for file uploads
   * @param {ImageUploadService} imageUploadService - Service for image uploads
   */
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly imageUploadService: ImageUploadService
  ) {}

  /**
   * Endpoint to upload a file
   * @param {any} file - The file to be uploaded
   * @param {string} propName - The property name for the file
   * @returns {Object} The path where the file is stored
   */
  @Post('/file')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: any,
    @Body('propName') propName: string
  ): { path: string } {
    return { path: this.fileUploadService.store(file, propName) }
  }

  /**
   * Endpoint to upload an image
   * @param {any} file - The image to be uploaded
   * @param {string} propName - The property name for the image
   * @returns {Object} The path where the image is stored
   */
  @Post('/image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @UploadedFile() file: any,
    @Body('propName') propName: string
  ): { path: string } {
    return { path: this.imageUploadService.store(file, propName) }
  }
}
