import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-date-yield',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="is-nowrap">{{ value | date: 'MM/dd/yy' }}</span>`,
  styleUrls: ['./date-yield.component.scss']
})
export class DateYieldComponent {
  @Input() value: Date
}
