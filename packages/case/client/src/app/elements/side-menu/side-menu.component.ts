import { Component } from '@angular/core'
import { SettingsService } from '../../shared/services/settings.service'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent {
  entities: any

  constructor(settingsService: SettingsService) {
    settingsService.loadSettings().subscribe((res) => {
      this.entities = res.entities
    })
  }
}
