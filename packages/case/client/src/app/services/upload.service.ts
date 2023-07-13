import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, firstValueFrom } from 'rxjs'
import { map } from 'rxjs/operators'

import { environment } from '../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  uploadEndpointUrl: string = environment.apiBaseUrl + '/upload'

  constructor(private http: HttpClient) {}

  upload(entitySlug: string, fileContent: any): Promise<any> {
    const formData = new FormData()

    formData.append('file', fileContent)
    formData.append('entitySlug', entitySlug)

    return firstValueFrom(
      this.http.post(`${this.uploadEndpointUrl}`, formData).pipe(
        map((response: any) => {
          return response
        })
      )
    )
  }
}
