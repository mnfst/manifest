import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { NotLoggedInGuard } from './guards/not-logged-in.guard'
import { LoginComponent } from './views/login/login.component'
import { LogoutComponent } from './views/logout/logout.component'

export const authRoutes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [NotLoggedInGuard]
  },
  {
    path: 'logout',
    component: LogoutComponent
  }
]

@NgModule({
  imports: [RouterModule.forChild(authRoutes)],
  exports: [RouterModule]
})
export class AuthRoutingModule {}
