import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { BrowserModule } from '@angular/platform-browser'
import { JwtModule } from '@auth0/angular-jwt'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { UserMenuItemComponent } from './components/user-menu-item/user-menu-item.component'
import { constants } from './constants'
import { FooterComponent } from './layout/footer/footer.component'
import { SideMenuComponent } from './layout/side-menu/side-menu.component'
import { TopMenuComponent } from './layout/top-menu/top-menu.component'
import { TouchMenuComponent } from './layout/touch-menu/touch-menu.component'
import { Error404Component } from './pages/error404/error404.component'
import { HomeComponent } from './pages/home/home.component'
import { FlashMessageComponent } from './partials/flash-message/flash-message.component'
import { CapitalizeFirstLetterPipe } from './pipes/capitalize-first-letter.pipe'

@NgModule({
  declarations: [
    AppComponent,
    SideMenuComponent,
    TouchMenuComponent,
    TopMenuComponent,
    HomeComponent,
    FooterComponent,
    FlashMessageComponent,
    Error404Component,
    UserMenuItemComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    JwtModule.forRoot({
      config: {
        tokenGetter: () => localStorage.getItem(constants.tokenName),
        // TODO (Ship): This should be an environment variable.
        allowedDomains: ['localhost:4000']
      }
    }),
    CapitalizeFirstLetterPipe
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
