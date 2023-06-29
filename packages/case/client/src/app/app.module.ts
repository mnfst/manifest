import { HttpClientModule } from '@angular/common/http'
import { APP_INITIALIZER, NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { BrowserModule } from '@angular/platform-browser'
import { firstValueFrom } from 'rxjs'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { AvatarComponent } from './components/avatar/avatar.component'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'
import { FooterComponent } from './layout/footer/footer.component'
import { SideMenuComponent } from './layout/side-menu/side-menu.component'
import { TopMenuComponent } from './layout/top-menu/top-menu.component'
import { TouchMenuComponent } from './layout/touch-menu/touch-menu.component'
import { HomeComponent } from './pages/home/home.component'
import { SettingsService } from './services/settings.service'
import { CapitalizeFirstLetterPipe } from './pipes/capitalize-first-letter.pipe'

@NgModule({
  declarations: [
    AppComponent,
    SideMenuComponent,
    TouchMenuComponent,
    TopMenuComponent,
    AvatarComponent,
    HomeComponent,
    FooterComponent,
    CapitalizeFirstLetterPipe
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    DynamicEntityModule
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (settingsService: SettingsService) => () =>
        firstValueFrom(settingsService.loadSettings()),
      deps: [SettingsService],
      multi: true
    },
    CapitalizeFirstLetterPipe
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
