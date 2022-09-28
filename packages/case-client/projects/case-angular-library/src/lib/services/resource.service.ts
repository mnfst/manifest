import { HttpClient, HttpParams } from '@angular/common/http'
import { Inject, Injectable } from '@angular/core'

import { CaseConfig } from '../interfaces/case-config.interface'
import { SelectOption } from '../interfaces/select-option.interface'

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor(
    private http: HttpClient,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  list(resourceName: string, refineParams?: object): Promise<any> {
    let httpParams = new HttpParams()

    if (refineParams) {
      Object.keys(refineParams)
        .filter(
          (key) => refineParams[key] !== undefined && refineParams[key] !== null
        )
        .forEach((key: string) => {
          if (Array.isArray(refineParams[key])) {
            refineParams[key].forEach((value: string) => {
              httpParams = httpParams.append(key, value)
            })
          } else {
            httpParams = httpParams.set(key, refineParams[key])
          }
        })
    }

    return this.http
      .get(`${this.config.apiBaseUrl}/${resourceName}`, {
        params: httpParams
      })
      .toPromise()
  }

  listSelectOptions(
    resourceName: string,
    refineParams?: object
  ): Promise<SelectOption[]> {
    return this.list(`${resourceName}/select-options`, refineParams)
  }

  show(
    resourceName: string,
    id: number | string,
    suffix?: string
  ): Promise<any> {
    return this.http
      .get(
        `${this.config.apiBaseUrl}/${resourceName}/${id}` +
          (suffix ? `/${suffix}` : '')
      )
      .toPromise()
  }

  store(resourceName: string, body: any): Promise<any> {
    return this.http
      .post(`${this.config.apiBaseUrl}/${resourceName}`, body)
      .toPromise()
  }

  duplicate(resourceName: string, id: number | string): Promise<any> {
    return this.http
      .post(`${this.config.apiBaseUrl}/${resourceName}/${id}/duplicate`, {})
      .toPromise()
  }

  update(resourceName: string, id: number | string, body: any): Promise<any> {
    return this.http
      .put(`${this.config.apiBaseUrl}/${resourceName}/${id}`, body)
      .toPromise()
  }

  patch(path: string, formData?: FormData): Promise<any> {
    return this.http
      .patch(`${this.config.apiBaseUrl}${path}`, formData)
      .toPromise()
  }

  delete(resourceName: string, id: number | string): Promise<any> {
    return this.http
      .delete(`${this.config.apiBaseUrl}/${resourceName}/${id}`)
      .toPromise()
  }
}
