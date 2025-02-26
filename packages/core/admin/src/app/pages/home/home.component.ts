import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'

import { ManifestService } from '../../modules/shared/services/manifest.service'
import { MetaService } from '../../modules/shared/services/meta.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  appManifest: AppManifest
  collections: EntityManifest[]
  singles: EntityManifest[]

  constructor(
    private manifestService: ManifestService,
    private metaService: MetaService
  ) {}

  ngOnInit(): void {
    this.manifestService.getManifest().then((res: AppManifest) => {
      this.appManifest = res
      this.collections = Object.values(res.entities || {}).filter(
        (entity) => !entity.single
      )
      this.singles = Object.values(res.entities || {}).filter(
        (entity) => entity.single
      )

      this.metaService.setTitle('Admin panel')
    })
  }
}
