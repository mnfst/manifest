import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@casejs/types'
import { BreadcrumbService } from '../../modules/shared/services/breadcrumb.service'
import { ManifestService } from '../../modules/shared/services/manifest.service'
// import { EntityMeta } from '~shared/interfaces/entity-meta.interface'

// import { AppConfig } from '../../../../../shared/interfaces/app-config.interface'
// import { DynamicEntityService } from '../../../dynamic-entity/dynamic-entity.service'
// import { BreadcrumbService } from '../../services/breadcrumb.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  appManifest: AppManifest
  entityManifests: EntityManifest[]

  constructor(
    private breadcrumbService: BreadcrumbService,
    private manifestService: ManifestService
  ) {
    //
    // dynamicEntityService: DynamicEntityService, // private appConfigService: AppConfigService,
    // dynamicEntityService.loadEntityMeta().subscribe((res: EntityMeta[]) => {
    //   this.entityMetas = res
    // })
  }

  ngOnInit(): void {
    this.breadcrumbService.breadcrumbLinks.next([])
    this.manifestService.getManifest().then((res: AppManifest) => {
      this.appManifest = res
      this.entityManifests = Object.values(res.entities || {})
    })
  }
}
