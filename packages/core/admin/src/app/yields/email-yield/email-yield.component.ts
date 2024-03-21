import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-email-yield',
  standalone: true,
  template: `<div class="yield">
    <div class="yield__value">{{ value }}</div>
  </div>`,
  styleUrls: ['./email-yield.component.scss']
})
export class EmailYieldComponent {
  @Input() value: string
}
