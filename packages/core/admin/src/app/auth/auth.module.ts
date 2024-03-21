import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'

import { InputComponent } from '../inputs/input.component'
import { AuthRoutingModule } from './auth-routing.module'
import { LoginComponent } from './views/login/login.component'
import { LogoutComponent } from './views/logout/logout.component'

@NgModule({
  declarations: [LoginComponent, LogoutComponent],
  imports: [CommonModule, AuthRoutingModule, InputComponent]
})
export class AuthModule {}
