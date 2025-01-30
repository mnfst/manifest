import { Injectable } from '@nestjs/common'
import { UploadService } from '../upload/services/upload.service'
import { CrudService } from '../crud/services/crud.service'
import { SDK } from '@repo/types'

/*
 * The BackendSDK class is a service that provides a way to interact with the Manifest backend from the dynamic handlers.
 *
 * It shares the same interface as the Frontend JavaScript SDK (https://www.npmjs.com/package/@mnfst/sdk).
 */

@Injectable()
export class BackendSDK implements SDK {
  constructor(
    private readonly uploadService: UploadService,
    private crudService: CrudService
  ) {}

  store(file: any) {
    return this.uploadService.storeFile({
      file: {
        buffer: file.buffer,
        originalname: file.originalname
      },
      entity: 'test',
      property: 'test'
    })
  }

  async findOneById(id: string) {
    const res = await this.crudService.findOne({
      entitySlug: 'cats',
      id: parseInt(id, 10)
    })
    console.log('res', res)
    return res
  }
}
