import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'
import { ADMIN_CLASS_NAME } from '../../../../constants'
import { ManifestService } from '../../shared/services/manifest.service'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent implements OnInit {
  collections: EntityManifest[]
  singles: EntityManifest[]

  isCollectionsOpen = false
  isSettingsOpen = false
  production: boolean

  constructor(private manifestService: ManifestService) {}

  ngOnInit(): void {
    this.manifestService.getManifest().then((res: AppManifest) => {
      this.production = res.production

      this.collections = Object.values(res.entities || {})
        .filter(
          (entityManifest: EntityManifest) =>
            entityManifest.className !== ADMIN_CLASS_NAME
        )
        .filter((entityManifest: EntityManifest) => !entityManifest.single)

      this.singles = Object.values(res.entities || {}).filter(
        (entityManifest: EntityManifest) => entityManifest.single
      )
    })
  }
}
