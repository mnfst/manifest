import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'

import { AuthRoutingModule } from './auth-routing.module'
import { LoginComponent } from './views/login/login.component'
import { InputComponent } from '../inputs/input.component'

@NgModule({
  declarations: [LoginComponent],
  imports: [CommonModule, AuthRoutingModule, InputComponent]
})
export class AuthModule {}
