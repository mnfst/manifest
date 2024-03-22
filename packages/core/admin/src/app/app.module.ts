import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { AuthModule } from './modules/auth/auth.module'
import { LayoutModule } from './modules/layout/layout.module'
import { SharedModule } from './modules/shared/shared.module'
import { Error404Component } from './pages/error404/error404.component'
import { HomeComponent } from './pages/home/home.component'
@NgModule({
  declarations: [AppComponent, HomeComponent, Error404Component],
  imports: [
    BrowserModule,
    AppRoutingModule,
    SharedModule,
    LayoutModule,
    AuthModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
