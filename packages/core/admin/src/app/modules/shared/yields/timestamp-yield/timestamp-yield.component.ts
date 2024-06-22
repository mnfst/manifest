import { DatePipe } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-timestamp-yield',
  standalone: true,
  imports: [DatePipe],
  template: `<span class="is-nowrap">{{
    value | date : 'yyyy-MM-dd HH:mm:ss'
  }}</span>`
})
export class TimestampYieldComponent {
  @Input() value: string
}
