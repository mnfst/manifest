import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'

import { ManifestService } from '../../modules/shared/services/manifest.service'
import { MetaService } from '../../modules/shared/services/meta.service'
import { ADMIN_CLASS_NAME } from '../../../constants'

@Component({
  selector: 'app-home-developer',
  templateUrl: './home-developer.component.html',
  styleUrls: ['./home-developer.component.scss']
})
export class HomeDeveloperComponent implements OnInit {
  appManifest: AppManifest
  collections: EntityManifest[]
  singles: EntityManifest[]

  constructor(
    private manifestService: ManifestService,
    private metaService: MetaService
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
    })
  }
}
