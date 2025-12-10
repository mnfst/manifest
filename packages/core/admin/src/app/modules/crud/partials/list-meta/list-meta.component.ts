import { Component, Input } from '@angular/core'
import { Paginator } from '@repo/types'

@Component({
  selector: 'app-list-meta',
  templateUrl: './list-meta.component.html',
  styleUrls: ['./list-meta.component.scss']
})
export class ListMetaComponent {
  @Input() paginator: Paginator<any>
}
