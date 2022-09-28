import {
  Directive,
  Input,
  OnInit,
  TemplateRef,
  ViewContainerRef
} from '@angular/core'
import { User } from '../interfaces/resources/user.interface'

import { AuthService } from '../services/auth.service'

@Directive({
  selector: '[caseHasPermission]'
})
export class HasPermissionDirective implements OnInit {
  @Input() set caseHasPermission(
    val:
      | string
      | { requireAnd?: string[]; requireOr?: string[]; hideIf?: string[] }
  ) {
    if (typeof val === 'string') {
      this.requiredPermissionsAnd = [val]
    } else if (typeof val === 'object') {
      this.requiredPermissionsAnd = val.requireAnd
      this.requiredPermissionsOr = val.requireOr
      this.hideIf = val.hideIf
    } else if (!val) {
      this.hasPermission = true
    }
  }

  private requiredPermissionsAnd: string[]
  private requiredPermissionsOr: string[]
  private hideIf: string[]
  private hasPermission: boolean
  private isHidden = true

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.authService.currentUser.subscribe((user: User) => {
      const currentUserPermissions: string[] =
        user && user.role ? user.role.permissions.map((p) => p.name) : []

      this.hasPermission = true

      if (
        this.requiredPermissionsAnd &&
        this.requiredPermissionsAnd.length &&
        !this.requiredPermissionsAnd.every((permission: string) =>
          currentUserPermissions.includes(permission)
        )
      ) {
        this.hasPermission = false
      }

      if (
        this.requiredPermissionsOr &&
        this.requiredPermissionsOr.length &&
        !this.requiredPermissionsOr.some((permission: string) =>
          currentUserPermissions.includes(permission)
        )
      ) {
        this.hasPermission = false
      }

      if (
        this.hideIf &&
        this.hideIf.length &&
        this.hideIf.some((permission: string) =>
          currentUserPermissions.includes(permission)
        )
      ) {
        this.hasPermission = false
      }

      if (this.hasPermission) {
        if (this.isHidden) {
          this.viewContainer.createEmbeddedView(this.templateRef)
          this.isHidden = false
        }
      } else {
        this.isHidden = true
        this.viewContainer.clear()
      }
    })
  }
}
