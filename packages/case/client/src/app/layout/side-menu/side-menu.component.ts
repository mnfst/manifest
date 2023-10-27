import { Component } from '@angular/core'

import { EntityMeta } from '../../../../../shared/interfaces/entity-meta.interface'
import { DynamicEntityService } from '../../dynamic-entity/dynamic-entity.service'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent {
  entityMetas: EntityMeta[]

  isCollectionsOpen = false
  isSettingsOpen = false

  constructor(dynamicEntityService: DynamicEntityService) {
    dynamicEntityService.loadEntityMeta().subscribe((res: EntityMeta[]) => {
      this.entityMetas = res
    })
  }
}
