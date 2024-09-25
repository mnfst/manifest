import { HttpException, Injectable } from '@nestjs/common'

@Injectable()
export class StorageService {
  storeFile({
    file,
    entity,
    property
  }: {
    file: any
    entity: string
    property: string
  }) {
    if (!file) {
      throw new HttpException('File should be provided', 400)
    }

    if (!entity || !property) {
      throw new HttpException(
        'Entity name and property should be provided',
        400
      )
    }
  }

  storeImage() {}

  private createPath(entity: string, property: string) {}
}
