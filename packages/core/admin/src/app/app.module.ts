import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { JwtModule } from '@auth0/angular-jwt'

import { TOKEN_KEY } from '../constants'
import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { AuthModule } from './modules/auth/auth.module'
import { LayoutModule } from './modules/layout/layout.module'
import { SharedModule } from './modules/shared/shared.module'
import { Error404Component } from './pages/error404/error404.component'
import { HomeDeveloperComponent } from './pages/home-developer/home-developer.component'
import { HomeComponent } from './pages/home/home.component'

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    HomeDeveloperComponent,
    Error404Component
  ],
  imports: [
    BrowserModule,
    JwtModule.forRoot({
      config: {
        tokenGetter: () => localStorage.getItem(TOKEN_KEY),
        // TODO (Ship): This should be an environment variable.
        allowedDomains: ['localhost:1111']
      }
    }),
    AppRoutingModule,
    SharedModule,
    LayoutModule,
    AuthModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
