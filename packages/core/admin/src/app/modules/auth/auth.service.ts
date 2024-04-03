import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { firstValueFrom } from 'rxjs'
import { TOKEN_KEY } from '../../../constants'
import { environment } from '../../../environments/environment'
import { Admin } from '../../typescript/interfaces/admin.interface'
import { FlashMessageService } from '../shared/services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserPromise: Promise<Admin> | null = null

  constructor(
    private http: HttpClient,
    private router: Router,
    private flashMessageService: FlashMessageService
  ) {}

  async login(credentials: {
    email: string
    password: string
  }): Promise<string> {
    return (
      firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/auth/admins/login`,
          credentials
        )
      ) as Promise<{
        token: string
      }>
    ).then((res: { token: string }) => {
      const token = res?.token
      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
      }
      return token
    })
  }

  logout(): void {
    delete this.currentUserPromise
    localStorage.removeItem(TOKEN_KEY)
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY)
  }

  async me(): Promise<Admin> {
    if (!this.currentUserPromise) {
      this.currentUserPromise = firstValueFrom(
        this.http.get(`${environment.apiBaseUrl}/auth/admins/me`)
      ).catch((err) => {
        this.logout
        this.router.navigate(['/auth/login'])
        this.flashMessageService.error(
          'You must be logged in to view that page.'
        )
      }) as Promise<Admin>
    }

    return this.currentUserPromise
  }
}
