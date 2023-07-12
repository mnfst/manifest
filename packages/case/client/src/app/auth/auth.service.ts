import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom, map } from 'rxjs'
import { environment } from '../../environments/environment'
import { constants } from '../constants'

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  apiBaseUrl = environment.apiBaseUrl

  constructor(private http: HttpClient) {}

  async login(credentials: {
    email: string
    password: string
  }): Promise<string> {
    return (
      firstValueFrom(
        this.http.post(`${this.apiBaseUrl}/auth/login`, credentials)
      ) as Promise<{
        token: string
      }>
    ).then((res: { token: string }) => {
      const token = res?.token
      if (token) {
        localStorage.setItem(constants.tokenName, token)
      }
      return token
    })
  }

  logout(): void {
    localStorage.removeItem(constants.tokenName)
  }
}
