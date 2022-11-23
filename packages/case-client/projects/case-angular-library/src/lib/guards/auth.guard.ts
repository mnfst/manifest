import { Inject, Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Router } from '@angular/router'
import { Observable } from 'rxjs'
import { CaseConfig } from '../interfaces/case-config.interface'

import { FlashMessageService } from '../services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  constructor(
    private router: Router,
    private flashMessageService: FlashMessageService,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}
  canActivate(
    next: ActivatedRouteSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    if (localStorage.getItem(this.config.tokenName)) {
      return true
    }

    this.router.navigate(['/login'], {
      queryParams:
        next.url && next.url.length ? { redirectTo: next.url[0].path } : {}
    })

    this.flashMessageService.info(
      'You need to be logged in to access this page.'
    )
    return false
  }
}
