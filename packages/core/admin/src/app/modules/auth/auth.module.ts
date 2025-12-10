import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'

import { SharedModule } from '../shared/shared.module'
import { AuthRoutingModule } from './auth-routing.module'
import { LoginComponent } from './views/login/login.component'
import { LogoutComponent } from './views/logout/logout.component'
import { RegisterFirstAdminComponent } from './views/register-first-admin/register-first-admin.component'

@NgModule({
  declarations: [LoginComponent, LogoutComponent, RegisterFirstAdminComponent],
  imports: [CommonModule, AuthRoutingModule, SharedModule]
})
export class AuthModule {}
