import { Component } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { SettingsService } from 'src/app/shared/services/settings.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  settings: any

  constructor(private router: Router, settingsService: SettingsService) {
    settingsService.loadSettings().subscribe((res) => {
      this.settings = res.settings
    })
  }
}
