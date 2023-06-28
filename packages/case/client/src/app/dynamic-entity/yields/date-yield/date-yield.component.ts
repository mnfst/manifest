import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-date-yield',
  template: ` {{ value | date : 'dd/MM/yy' }}`,
  styleUrls: ['./date-yield.component.scss']
})
export class DateYieldComponent {
  @Input() value: Date
}
