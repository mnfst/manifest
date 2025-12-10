import { Injectable } from '@angular/core'
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router'
import { AdminAccess } from '../../../../../../types/src'

// Prevent access to admins collection if access outside of backend builder.
@Injectable({
  providedIn: 'root'
})
export class RestrictAdminCollectionGuard {
  constructor(private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const requiredAccess = route.data['requiredAccess'] as AdminAccess
    const urlSegments = state.url.split('/')
    const hasAdminsSlug = urlSegments.includes('admins')

    // If trying to access admins collection without backend builder access
    if (hasAdminsSlug && requiredAccess !== 'hasBackendBuilderAccess') {
      this.router.navigate(['/404'])
      return false
    }

    return true
  }
}
