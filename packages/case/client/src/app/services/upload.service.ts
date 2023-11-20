import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { map } from 'rxjs/operators'

import { environment } from '../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  uploadEndpointUrl: string = environment.apiBaseUrl + '/upload'

  constructor(private http: HttpClient) {}

  uploadImage(
    entitySlug: string,
    propName: string,
    fileContent: any
  ): Promise<{ [key: string]: string }> {
    const formData = new FormData()

    formData.append('image', fileContent)
    formData.append('entitySlug', entitySlug)
    formData.append('propName', propName)

    return firstValueFrom(
      this.http.post(`${this.uploadEndpointUrl}/image`, formData).pipe(
        map((response: any) => {
          return response
        })
      )
    )
  }

  uploadFile(entitySlug: string, fileContent: any): Promise<any> {
    const formData = new FormData()

    formData.append('file', fileContent)
    formData.append('entitySlug', entitySlug)

    return firstValueFrom(
      this.http.post(`${this.uploadEndpointUrl}/file`, formData).pipe(
        map((response: any) => {
          return response
        })
      )
    )
  }
}
