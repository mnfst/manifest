import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { FlashMessageService } from './flash-message.service'
import { environment } from '../../../../environments/environment'
import { firstValueFrom } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class OpenApiService {
  openApiDocsUrl = environment.apiBaseUrl + '/open-api'

  constructor(
    private http: HttpClient,
    private flashMessageService: FlashMessageService
  ) {}

  /**
   * Wrapper method to handle promises with flash messages
   */
  private async handleRequest<T>(promise: Promise<T>): Promise<T> {
    try {
      const result = await promise

      return result
    } catch (error) {
      // Add your flash message service here
      // this.flashMessageService.error(message)
      this.flashMessageService.error(
        (error as HttpErrorResponse).error?.message || 'An error occurred'
      )
      throw error
    }
  }

  getOpenApiDocs(): Promise<any> {
    return this.handleRequest(
      firstValueFrom(this.http.get(this.openApiDocsUrl))
    )
  }
}
