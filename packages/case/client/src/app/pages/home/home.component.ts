import { Component } from '@angular/core'
import { SettingsService } from 'src/app/services/settings.service'
import { BreadcrumbService } from '../../services/breadcrumb.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  settings: any

  constructor(
    settingsService: SettingsService,
    breadcrumbService: BreadcrumbService
  ) {
    settingsService.loadSettings().subscribe((res) => {
      this.settings = res.settings
    })
    breadcrumbService.breadcrumbLinks.next([
      {
        label: 'Home'
      }
    ])
  }
}
