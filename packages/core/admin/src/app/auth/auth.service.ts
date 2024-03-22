import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { TOKEN_KEY } from '../../constants'
import { environment } from '../../environments/environment'
import { Admin } from '../typescript/interfaces/admin.interface'

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public currentUser: ReplaySubject<Admin> = new ReplaySubject<Admin>(1)

  constructor(private http: HttpClient) {}

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
    localStorage.removeItem(TOKEN_KEY)
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY)
  }

  async me(): Promise<Admin> {
    const admin: Admin = (await firstValueFrom(
      this.http.get(`${environment.apiBaseUrl}/auth/admins/me`)
    )) as Admin

    if (!admin) {
      this.logout()
      return Promise.reject('No admin found.')
    }

    this.currentUser.next(admin)
    return admin
  }
}
