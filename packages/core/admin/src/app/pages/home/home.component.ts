import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'

import { ManifestService } from '../../modules/shared/services/manifest.service'
import { MetaService } from '../../modules/shared/services/meta.service'
import { ADMIN_CLASS_NAME } from '../../../constants'
import { VersionService } from '../../modules/shared/services/version.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  appManifest: AppManifest
  collections: EntityManifest[]
  singles: EntityManifest[]

  newVersionAvailable: boolean = false
  latestVersion: string = ''

  constructor(
    private manifestService: ManifestService,
    private metaService: MetaService,
    private versionService: VersionService
  ) {}

  ngOnInit(): void {
    this.metaService.setTitle('Admin panel')

    this.manifestService.getManifest().then((res: AppManifest) => {
      this.appManifest = res
      this.collections = Object.values(res.entities || {})
        .filter(
          (entityManifest: EntityManifest) =>
            entityManifest.className !== ADMIN_CLASS_NAME
        )
        .filter((entityManifest: EntityManifest) => !entityManifest.single)
        .filter((entityManifest: EntityManifest) => !entityManifest.nested)

      this.singles = Object.values(res.entities || {}).filter(
        (entity) => entity.single
      )

      this.checkForUpdates()
    })
  }

  checkForUpdates(): void {
    this.versionService
      .checkForUpdates({
        currentVersion: this.appManifest.version || '0.0.0',
        currentEnv: this.appManifest.environment || 'development'
      })
      .then((result) => {
        this.newVersionAvailable = result.isUpdateAvailable
        this.latestVersion = result.latestVersion
      })
      .catch((error) => {
        console.error('Error checking for updates:', error)
      })
  }
}
