import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@manifest-yml/types'
import { ADMIN_CLASS_NAME } from '../../../../constants'
import { ManifestService } from '../../shared/services/manifest.service'

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
      this.entityManifests = Object.values(res.entities || {}).filter(
        (entityManifest: EntityManifest) =>
          entityManifest.className !== ADMIN_CLASS_NAME
      )
    })
  }
}
