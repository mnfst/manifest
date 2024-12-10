import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '../auth.service'

@Injectable({
  providedIn: 'root'
})
export class IsDbEmptyGuard {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  async canActivate(): Promise<boolean> {
    const isDbEmpty = await this.authService.isDbEmpty()

    if (isDbEmpty) {
      return true
    }

    this.router.navigate(['/auth/login'])
    return false
  }
}
