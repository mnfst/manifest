import { Route } from '@angular/router'
import { ResourceMode } from '../enums/resource-mode.enum'

import { AuthGuard } from '../guards/auth.guard'
import { PermissionGuard } from '../guards/permission.guard'
import { ForgotPasswordComponent } from '../pages/auth/forgot-password/forgot-password.component'
import { LoginComponent } from '../pages/auth/login/login.component'
import { LogoutComponent } from '../pages/auth/logout/logout.component'
import { ResetPasswordComponent } from '../pages/auth/reset-password/reset-password.component'
import { Error404Component } from '../pages/error404/error404.component'
import { RoleCreateEditComponent } from '../resources/role/role-create-edit/role-create-edit.component'
import { RoleListComponent } from '../resources/role/role-list/role-list.component'

export const caseRoutes: Route[] = [
  // Auth.
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'logout',
    component: LogoutComponent
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent
  },

  // Roles.
  {
    path: 'roles',
    component: RoleListComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      permission: 'browseRoles'
    }
  },
  {
    path: 'roles/create',
    component: RoleCreateEditComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      permission: 'addRoles',
      mode: ResourceMode.Create
    }
  },
  {
    path: 'roles/:id/edit',
    component: RoleCreateEditComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      permission: 'editRoles',
      mode: ResourceMode.Edit
    }
  },

  // 404.
  {
    path: '404',
    component: Error404Component,
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/404'
  }
]
