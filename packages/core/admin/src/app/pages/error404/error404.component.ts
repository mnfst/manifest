import { Component } from '@angular/core'
import { MetaService } from '../../modules/shared/services/meta.service'

@Component({
  selector: 'app-error404',
  templateUrl: './error404.component.html',
  styleUrls: ['./error404.component.scss']
})
export class Error404Component {
  constructor(metaService: MetaService) {
    metaService.setTitle('Page not found')
  }
}
