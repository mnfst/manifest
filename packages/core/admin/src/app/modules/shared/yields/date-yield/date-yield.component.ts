import { DatePipe, NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-date-yield',
  standalone: true,
  imports: [DatePipe, NgIf],
  template: `<span class="is-nowrap">{{ value | date : 'MM/dd/yy' }}</span>
    <span class="is-nowrap" *ngIf="!value"> - </span> `,
  styleUrls: ['./date-yield.component.scss']
})
export class DateYieldComponent {
  @Input() value: Date
}
