import { HttpClientModule } from '@angular/common/http'
import { APP_INITIALIZER, NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { BrowserModule } from '@angular/platform-browser'
import { firstValueFrom } from 'rxjs'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'
import { SettingsService } from './shared/services/settings.service'
import { SideMenuComponent } from './components/side-menu/side-menu.component'
import { TouchMenuComponent } from './components/touch-menu/touch-menu.component'
import { TopMenuComponent } from './components/top-menu/top-menu.component'
import { BreadcrumbsComponent } from './components/breadcrumbs/breadcrumbs.component'
import { AvatarComponent } from './components/avatar/avatar.component'
import { HomeComponent } from './pages/home/home.component'
import { FooterComponent } from './components/footer/footer.component'

@NgModule({
  declarations: [
    AppComponent,
    SideMenuComponent,
    TouchMenuComponent,
    TopMenuComponent,
    BreadcrumbsComponent,
    AvatarComponent,
    HomeComponent,
    FooterComponent
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
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
