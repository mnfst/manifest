import { Injectable } from '@angular/core'
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router'

@Injectable({
  providedIn: 'root'
})
export class RestrictAdminCollectionGuard {
  constructor(private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isDeveloperAccess = route.data['isDeveloperAccess'] || false
    const urlSegments = state.url.split('/')
    const hasAdminsSlug = urlSegments.includes('admins')

    // If trying to access admins collection without developer access
    if (hasAdminsSlug && !isDeveloperAccess) {
      this.router.navigate(['/404'])
      return false
    }

    return true
  }
}
