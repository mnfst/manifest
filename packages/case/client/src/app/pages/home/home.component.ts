import { Component } from '@angular/core'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'

import { DynamicEntityService } from '../../dynamic-entity/dynamic-entity.service'
import { BreadcrumbService } from '../../services/breadcrumb.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  isAppBlank: boolean
  entityMetas: EntityMeta[]

  constructor(
    dynamicEntityService: DynamicEntityService,
    breadcrumbService: BreadcrumbService
  ) {
    dynamicEntityService.loadEntityMeta().subscribe((res: EntityMeta[]) => {
      this.isAppBlank = res.length === 0
      this.entityMetas = res
    })
    breadcrumbService.breadcrumbLinks.next([])
  }
}
