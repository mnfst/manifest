import { Component } from '@angular/core'
import { AppConfig } from '~shared/interfaces/app-config.interface'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'

import { DynamicEntityService } from '../../dynamic-entity/dynamic-entity.service'
import { AppConfigService } from '../../services/app-config.service'
import { BreadcrumbService } from '../../services/breadcrumb.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  appConfig: AppConfig
  isAppBlank: boolean

  constructor(
    appConfigService: AppConfigService,
    dynamicEntityService: DynamicEntityService,
    breadcrumbService: BreadcrumbService
  ) {
    appConfigService.loadAppConfig().subscribe((res) => {
      this.appConfig = res
    })
    dynamicEntityService.loadEntityMeta().subscribe((res: EntityMeta[]) => {
      this.isAppBlank = res.length === 0
    })
    breadcrumbService.breadcrumbLinks.next([])
  }
}
