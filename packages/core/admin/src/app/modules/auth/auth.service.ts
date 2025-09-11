import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import {
  BehaviorSubject,
  catchError,
  firstValueFrom,
  Observable,
  of,
  tap,
  throwError
} from 'rxjs'
import { TOKEN_KEY } from '../../../constants'
import { environment } from '../../../environments/environment'
import { Admin } from '../../typescript/interfaces/admin.interface'
import { FlashMessageService } from '../shared/services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<Admin> =
    new BehaviorSubject<Admin>(null)
  public currentUser$: Observable<Admin> =
    this.currentUserSubject.asObservable()

  private isUserLoaded = false

  constructor(
    private http: HttpClient,
    private router: Router,
    private flashMessageService: FlashMessageService
  ) {}

  /**
   * Logs in an admin user.
   *
   * @param {Object} credentials - The credentials of the admin user
   * @param {string} credentials.email - The email of the admin user
   * @param {string} credentials.password - The password of the admin user
   *
   * @returns {Promise<string>} The token of the admin user
   */
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
    ).then(async (res: { token: string }) => {
      const token = res?.token
      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
      }
      this.currentUserSubject.next(await firstValueFrom(this.loadCurrentUser()))
      return token
    })
  }

  /**
   * Signs up a new admin and logs them in.
   *
   * @param {Object} credentials - The credentials of the new admin
   * @param {string} credentials.email - The email of the new admin
   * @param {string} credentials.password - The password of the new admin
   *
   * @returns {Promise<string>} The token of the new admin
   */
  async signup(credentials: {
    email: string
    password: string
  }): Promise<string> {
    return (
      firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/auth/admins/signup`,
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
    this.currentUserSubject.next(null)
    localStorage.removeItem(TOKEN_KEY)
    this.isUserLoaded = false
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value
  }

  loadCurrentUser(): Observable<Admin> {
    if (this.isUserLoaded) {
      return of(this.currentUserSubject.value)
    }

    return this.http
      .get<Admin>(`${environment.apiBaseUrl}/auth/admins/me`)
      .pipe(
        tap((user: Admin) => {
          this.isUserLoaded = true
          this.currentUserSubject.next(user)
        }),
        catchError((error) => {
          this.logout()
          this.router.navigate(['/auth/login'])
          this.flashMessageService.error(
            'You must be logged in to view that page.'
          )
          return throwError(() => error)
        })
      )
  }

  /**
   * Returns the current user without subscribing to the observable.
   *
   * @returns {Admin} The current user
   */
  public getCurrentUserValue(): Admin {
    return this.currentUserSubject.value
  }

  /**
   * Returns true if the default user admin is in the database, false otherwise
   */
  async isDefaultAdminExists(): Promise<boolean> {
    return (
      firstValueFrom(
        this.http.get(`${environment.apiBaseUrl}/auth/admins/default-exists`)
      ) as Promise<{ exists: boolean }>
    ).then((res) => res.exists)
  }

  /**
   * Returns true if the database is empty (no items, even admins), false otherwise.
   *
   * @returns {Promise<boolean>} true if the database is empty, false otherwise
   */
  async isDbEmpty(): Promise<boolean> {
    return (
      firstValueFrom(
        this.http.get(`${environment.apiBaseUrl}/db/is-db-empty`)
      ) as Promise<{ empty: boolean }>
    ).then((res) => res.empty)
  }
}
