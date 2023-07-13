import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, firstValueFrom } from 'rxjs'
import { map } from 'rxjs/operators'

import { environment } from '../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  uploadEndpointUrl: string = environment.apiBaseUrl + '/upload/file'

  constructor(private http: HttpClient) {}

  upload(propName: string, fileContent: any): Promise<any> {
    const formData = new FormData()

    formData.append('file', fileContent)
    formData.append('propName', propName)

    return firstValueFrom(
      this.http.post(`${this.uploadEndpointUrl}`, formData).pipe(
        map((response: any) => {
          return response
        })
      )
    )
  }
}
