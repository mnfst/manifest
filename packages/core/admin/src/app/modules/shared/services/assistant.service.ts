import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { environment } from '../../../../environments/environment.development'
import { firstValueFrom } from 'rxjs/internal/firstValueFrom'

@Injectable({
  providedIn: 'root'
})
export class AssistantService {
  constructor(private http: HttpClient) {}

  createProject(prompt: string, attachment: File | null): Promise<any> {
    const formData = new FormData()
    formData.append('prompt', prompt)
    if (attachment) {
      formData.append('file', attachment)
    }

    return firstValueFrom(
      this.http.post(`${environment.platformBaseUrl}/projects`, formData)
    )
  }
}
