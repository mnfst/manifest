import { Component } from '@angular/core'
import { SettingsService } from 'src/app/services/settings.service'

import { AppSettings } from '../../../../../shared/interfaces/app-settings.interface'
import { BreadcrumbService } from '../../services/breadcrumb.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  settings: AppSettings
  isAppBlank: boolean

  constructor(
    settingsService: SettingsService,
    breadcrumbService: BreadcrumbService
  ) {
    settingsService.loadSettings().subscribe((res) => {
      this.settings = res.settings
      this.isAppBlank = res.entities.length === 0
    })
    breadcrumbService.breadcrumbLinks.next([
      {
        label: 'Home'
      }
    ])
  }
}
