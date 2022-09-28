import { Inject, Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { CaseConfig } from '../interfaces/case-config.interface'

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  constructor(
    private http: HttpClient,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  uploadImage(resourceName: string, fileContent: any): Observable<any> {
    return this.upload('image', resourceName, fileContent)
  }

  uploadFile(resourceName: string, fileContent: any): Observable<any> {
    return this.upload('file', resourceName, fileContent)
  }

  private upload(
    uploadType: string,
    resourceName: string,
    fileContent: any
  ): Observable<any> {
    const formData = new FormData()

    formData.append('file', fileContent)
    formData.append('resourceName', resourceName)

    return this.http
      .post(`${this.config.apiBaseUrl}/upload/${uploadType}`, formData)
      .pipe(
        map((response: { path: string }) => {
          return response
        })
      )
  }
}
