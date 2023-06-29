import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-date-yield',
  template: ` {{ value | date : 'MM/dd/yy' }}`,
  styleUrls: ['./date-yield.component.scss']
})
export class DateYieldComponent {
  @Input() value: Date
}
