import { Component } from '@angular/core'

import { AppConfig } from '../../../../../shared/interfaces/app-config.interface'
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
    breadcrumbService: BreadcrumbService
  ) {
    appConfigService.loadAppConfig().subscribe((res) => {
      this.appConfig = res
      // this.isAppBlank = res.entities.length === 0
    })
    breadcrumbService.breadcrumbLinks.next([])
  }
}
