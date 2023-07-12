import { Component } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'

import { SettingsService } from './services/settings.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  isCollapsed = false
  isLogin = true

  constructor(private router: Router, settingsService: SettingsService) {
    settingsService.loadSettings().subscribe((res) => {})
  }

  ngOnInit() {
    this.router.events.subscribe((routeChanged) => {
      if (routeChanged instanceof NavigationEnd) {
        window.scrollTo(0, 0)

        this.isLogin = routeChanged.url.includes('/auth/login')
      }
    })
  }
}
