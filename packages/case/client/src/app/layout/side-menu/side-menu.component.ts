import { Component } from '@angular/core'

import { EntityMeta } from '../../../../../shared/interfaces/entity-meta.interface'
import { SettingsService } from '../../services/settings.service'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent {
  entities: EntityMeta[]

  constructor(settingsService: SettingsService) {
    settingsService.loadSettings().subscribe((res) => {
      this.entities = res.entities
    })
  }
}
