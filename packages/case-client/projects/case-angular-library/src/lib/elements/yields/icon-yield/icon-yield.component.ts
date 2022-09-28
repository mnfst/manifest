import { Component, Input } from '@angular/core'

@Component({
  selector: 'case-icon-yield',
  templateUrl: './icon-yield.component.html',
  styleUrls: ['./icon-yield.component.scss']
})
export class IconYieldComponent {
  @Input() icon: string
  @Input() tooltip?: string
}
