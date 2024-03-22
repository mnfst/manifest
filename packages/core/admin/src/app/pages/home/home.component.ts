import { Component, OnInit } from '@angular/core'
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
  entityMetas: any[]
  appConfig: any

  constructor() { //   breadcrumbService: BreadcrumbService // dynamicEntityService: DynamicEntityService, // private appConfigService: AppConfigService,
    // dynamicEntityService.loadEntityMeta().subscribe((res: EntityMeta[]) => {
    //   this.entityMetas = res
    // })
    // breadcrumbService.breadcrumbLinks.next([])
  }

  ngOnInit(): void {
    // this.appConfigService.appConfig.subscribe((res: AppConfig) => {
    //   this.appConfig = res
    // })
  }
}
