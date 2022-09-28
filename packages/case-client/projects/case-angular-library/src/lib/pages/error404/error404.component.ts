import { Component } from '@angular/core'
import { BreadcrumbService } from '../../services/breadcrumb.service'

@Component({
  selector: 'app-error404',
  templateUrl: './error404.component.html',
  styleUrls: ['./error404.component.scss']
})
export class Error404Component {
  constructor(breadcrumbService: BreadcrumbService) {
    breadcrumbService.breadcrumbLinks.next([
      {
        label: 'Erreur 404'
      }
    ])
  }
}
