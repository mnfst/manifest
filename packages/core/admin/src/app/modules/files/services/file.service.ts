import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { environment } from '../../../../environments/environment'
import { firstValueFrom } from 'rxjs'
import { StorageFile, StorageFolder } from '@repo/types'

@Injectable({
  providedIn: 'root'
})
export class FileService {
  constructor(private http: HttpClient) {}

  async list(
    path: string = null,
    maxItems: string = '100',
    continuationToken: string | null = null
  ): Promise<{
    files: StorageFile[]
    folders: StorageFolder[]
    count: number
    isTruncated: boolean
    nextContinuationToken?: string
  }> {
    let params = new HttpParams()

    if (path) {
      params = params.set('path', path)
    }
    if (maxItems) {
      params = params.set('maxItems', maxItems)
    }
    if (continuationToken) {
      params = params.set('continuationToken', continuationToken)
    }

    return firstValueFrom(
      this.http.get(`${environment.apiBaseUrl}/storage`, {
        params
      })
    ).catch((error) => {
      console.error('Error listing files:', error)
      throw error
    }) as Promise<{
      files: StorageFile[]
      folders: StorageFolder[]
      count: number
      isTruncated: boolean
      nextContinuationToken?: string
    }>
  }

  async updateManifestFile(content: string): Promise<any> {
    return firstValueFrom(
      this.http.put(`${environment.apiBaseUrl}/manifest-file`, {
        content
      })
    ).catch((error) => {
      console.error('Error updating manifest file:', error)
      throw error
    })
  }

  async create(
    file: File,
    path: string
  ): Promise<{ key: string; url: string }> {
    const arrayBuffer = await file.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: file.type })

    const formData = new FormData()
    formData.append('file', blob, file.name)
    formData.append('path', path)

    return firstValueFrom(
      this.http.post<{ key: string; url: string }>(
        `${environment.apiBaseUrl}/storage/upload`,
        formData
      )
    ).catch((error) => {
      console.error('Error uploading file:', error)
      throw error
    })
  }
}
