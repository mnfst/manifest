import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@casejs/types'
import { ManifestService } from '../../shared/services/manifest.service'

// import { EntityMeta } from '../../../../../shared/interfaces/entity-meta.interface'
// import { DynamicEntityService } from '../../../dynamic-entity/dynamic-entity.service'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent implements OnInit {
  entityManifests: EntityManifest[]

  isCollectionsOpen = false
  isSettingsOpen = false

  constructor(private manifestService: ManifestService) {}

  ngOnInit(): void {
    this.manifestService.getManifest().then((res: AppManifest) => {
      this.entityManifests = Object.values(res.entities || {})
    })
  }
}
