import { Component, Input } from '@angular/core'
import { Paginator } from '~shared/interfaces/paginator.interface'

@Component({
  selector: 'app-list-meta',
  templateUrl: './list-meta.component.html',
  styleUrls: ['./list-meta.component.scss']
})
export class ListMetaComponent {
  @Input() paginator: Paginator<any>
}
