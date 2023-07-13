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

  uploadImage(resourceName: string, fileContent: any): Promise<any> {
    return this.upload('image', resourceName, fileContent)
  }

  uploadFile(resourceName: string, fileContent: any): Promise<any> {
    return this.upload('file', resourceName, fileContent)
  }

  upload(uploadType: string, propName: string, fileContent: any): Promise<any> {
    const formData = new FormData()

    formData.append('file', fileContent)
    formData.append('propName', propName)

    return firstValueFrom(
      this.http.post(`${this.uploadEndpointUrl}/${uploadType}`, formData).pipe(
        map((response: any) => {
          return response
        })
      )
    )
  }
}
