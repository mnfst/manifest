import { Component } from '@angular/core'

import { EntityMeta } from '../../../../../shared/interfaces/entity-meta.interface'
import { AppConfigService } from '../../services/app-config.service'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent {
  entities: EntityMeta[]

  constructor(appConfigService: AppConfigService) {
    appConfigService.loadAppConfig().subscribe((res) => {
      // this.entities = res.entities
    })
  }
}
