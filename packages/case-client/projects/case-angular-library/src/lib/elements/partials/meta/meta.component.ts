import { Component, Input } from '@angular/core'
import { Paginator } from '../../../interfaces/paginator.interface'

@Component({
  selector: 'case-meta',
  templateUrl: './meta.component.html',
  styleUrls: ['./meta.component.scss']
})
export class MetaComponent {
  @Input() paginator: Paginator<any>
}
