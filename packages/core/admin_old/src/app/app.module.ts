import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { BrowserModule } from '@angular/platform-browser'
import { JwtModule } from '@auth0/angular-jwt'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { constants } from './constants'
import { AuthModule } from './modules/auth/auth.module'
import { SharedModule } from './modules/shared/shared.module'

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    JwtModule.forRoot({
      config: {
        tokenGetter: () => localStorage.getItem(constants.tokenName),
        // TODO (Ship): This should be an environment variable.
        allowedDomains: ['localhost:1111']
      }
    }),
    SharedModule,
    AuthModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
