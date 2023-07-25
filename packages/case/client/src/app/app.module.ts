import { HttpClientModule } from '@angular/common/http'
import { APP_INITIALIZER, NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { BrowserModule } from '@angular/platform-browser'
import { JwtModule } from '@auth0/angular-jwt'
import { combineLatest } from 'rxjs'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { AvatarComponent } from './components/avatar/avatar.component'
import { constants } from './constants'
import { FooterComponent } from './layout/footer/footer.component'
import { SideMenuComponent } from './layout/side-menu/side-menu.component'
import { TopMenuComponent } from './layout/top-menu/top-menu.component'
import { TouchMenuComponent } from './layout/touch-menu/touch-menu.component'
import { Error404Component } from './pages/error404/error404.component'
import { HomeComponent } from './pages/home/home.component'
import { FlashMessageComponent } from './partials/flash-message/flash-message.component'
import { CapitalizeFirstLetterPipe } from './pipes/capitalize-first-letter.pipe'
import { AppConfigService } from './services/app-config.service';
import { UserMenuItemComponent } from './components/user-menu-item/user-menu-item.component'

@NgModule({
  declarations: [
    AppComponent,
    SideMenuComponent,
    TouchMenuComponent,
    TopMenuComponent,
    AvatarComponent,
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
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (appConfigService: AppConfigService) => () =>
        combineLatest([appConfigService.loadAppConfig()]),
      deps: [AppConfigService],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
