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
  entityMetas: EntityMeta[]

  constructor(
    dynamicEntityService: DynamicEntityService,
    breadcrumbService: BreadcrumbService
  ) {
    dynamicEntityService.loadEntityMeta().subscribe((res: EntityMeta[]) => {
      this.entityMetas = res
    })
    breadcrumbService.breadcrumbLinks.next([])
  }
}
