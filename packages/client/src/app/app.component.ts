import { Component } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'

import { SettingsService } from './shared/services/settings.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  settings: any

  constructor(private router: Router, settingsService: SettingsService) {
    settingsService.loadSettings().subscribe((res) => {
      this.settings = res.settings
    })
  }

  ngOnInit() {
    this.router.events.subscribe((routeChanged) => {
      if (routeChanged instanceof NavigationEnd) {
        window.scrollTo(0, 0)
      }
    })
  }
}
