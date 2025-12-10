import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { environment } from '../../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  constructor(private http: HttpClient) {}

  /**
   * Upload an image.
   *
   * @param entity The entity name.
   * @param property The property name.
   * @param fileContent The image to upload.
   *
   * @returns The path of the different sizes of the uploaded image.
   *
   **/
  uploadImage({
    entity,
    property,
    fileContent
  }: {
    entity: string
    property: string
    fileContent: any
  }): Promise<any> {
    return this.upload({
      type: 'image',
      entity,
      property,
      fileContent
    })
  }

  /**
   * Upload a file.
   *
   * @param entity The entity name.
   * @param property The property name.
   * @param fileContent The file to upload.
   *
   * @returns The path of the uploaded file.
   */
  async uploadFile({
    entity,
    property,
    fileContent
  }: {
    entity: string
    property: string
    fileContent: any
  }): Promise<any> {
    return this.upload({
      type: 'file',
      entity,
      property,
      fileContent
    })
  }

  private async upload({
    type,
    entity,
    property,
    fileContent
  }: {
    type: 'image' | 'file'
    entity: string
    property: string
    fileContent: any
  }): Promise<any> {
    const formData = new FormData()

    formData.append(type, fileContent)
    formData.append('entity', entity)
    formData.append('property', property)

    return firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/upload/${type}`, formData)
    ).catch((err) => {
      throw new Error(err.error.message)
    })
  }
}
