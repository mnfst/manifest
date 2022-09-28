import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http'
import { Inject, Injectable } from '@angular/core'
import { Router } from '@angular/router'
import * as HttpStatus from 'http-status-codes'
import { Observable, of, ReplaySubject } from 'rxjs'
import { catchError, map } from 'rxjs/operators'

import { CaseConfig } from '../interfaces/case-config.interface'
import { User } from '../interfaces/resources/user.interface'
import { FlashMessageService } from './flash-message.service'
import { HelperService } from './helper.service'

@Injectable()
export class AuthService {
  token: string
  permissions: string[]
  baseUrl = `${this.config.apiBaseUrl}/auth`

  public currentUser = new ReplaySubject(1)
  public tokenAllowedDomains: string[]

  constructor(
    private http: HttpClient,
    private router: Router,
    private flashMessageService: FlashMessageService,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {
    // Set token if saved in local storage
    this.token = localStorage.getItem(this.config.tokenName)
    this.tokenAllowedDomains = this.config.tokenAllowedDomains
  }

  login(email: string, password: string): Observable<string> {
    return this.http.post(`${this.baseUrl}/login`, { email, password }).pipe(
      map(
        (res: {
          accessToken: string
          permissions: string[]
          homepagePath: string
        }) => {
          const token = res && res.accessToken

          if (token) {
            this.token = token
            this.permissions = res.permissions

            // Store JWT token and Permissions in local storage
            localStorage.setItem(this.config.tokenName, token)

            return res.homepagePath
          }
          return null
        }
      )
    )
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.config.tokenName)
  }

  getToken(): string {
    return localStorage.getItem(this.config.tokenName)
  }

  // Get Current user permissions from Service or from remote API.
  getPermissions(): Promise<string[]> {
    if (this.permissions) {
      return Promise.resolve(this.permissions)
    } else {
      return this.me()
        .toPromise()
        .then((userRes: User) => userRes.role.permissions.map((p) => p.name))
    }
  }

  // Check if current user have a specific permission
  async can(permission: string): Promise<boolean> {
    const userPermissions: string[] = await this.getPermissions()

    return (
      userPermissions &&
      userPermissions.length &&
      userPermissions.includes(permission)
    )
  }

  logout(): void {
    delete this.token
    delete this.permissions
    localStorage.removeItem(this.config.tokenName)
    this.currentUser.next(null)
  }

  me(): Observable<User | boolean> {
    return this.http.get(`${this.baseUrl}/me`).pipe(
      map((userRes: User) => {
        // Store permissions in service.
        this.permissions = userRes.role.permissions.map((p) => p.name)
        return userRes
      }),
      catchError((err: HttpErrorResponse) => {
        // Redirect to login if no user in DB.
        if (err.status === HttpStatus.StatusCodes.FORBIDDEN) {
          this.router.navigate(['/logout'])
        } else {
          this.flashMessageService.error(
            `Erreur: Impossible de se connecter au serveur. Veuillez vérifier la connexion internet et rafraîchir la page.`
          )
        }

        return of(false)
      })
    )
  }

  sendResetPasswordEmail(email: string) {
    let params = new HttpParams()
    params = params.set('email', email)

    return this.http
      .get(`${this.baseUrl}/forgot-password`, { params })
      .pipe(map((res: any) => res))
  }

  resetPassword(newPassword: string, token: string) {
    return this.http
      .post(`${this.baseUrl}/reset-password`, {
        newPassword,
        token
      })
      .pipe(map((res: any) => res))
  }

  getCreateResourcesPermissionName(resourceSlug: string): string {
    return `add${HelperService.classify(resourceSlug)}`
  }
}
