import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom, ReplaySubject } from 'rxjs'

import { environment } from '../../environments/environment'
import { constants } from '../constants'
import { User } from '../interfaces/user.interface'

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public currentUser: ReplaySubject<User> = new ReplaySubject<User>(1)

  constructor(private http: HttpClient) {}

  async login(credentials: {
    email: string
    password: string
  }): Promise<string> {
    return (
      firstValueFrom(
        this.http.post(`${environment.apiBaseUrl}/auth/login`, credentials)
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

  isLoggedIn(): boolean {
    return !!localStorage.getItem(constants.tokenName)
  }

  async me(): Promise<User> {
    const user: User = (await firstValueFrom(
      this.http.get(`${environment.apiBaseUrl}/auth/me`)
    )) as User

    if (!user) {
      this.logout()
      return Promise.reject('No user found.')
    }

    this.currentUser.next(user)
    return user
  }
}
