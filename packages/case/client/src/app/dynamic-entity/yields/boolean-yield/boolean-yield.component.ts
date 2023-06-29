import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-boolean-yield',
  template: `
    <div>
      <span *ngIf="value">true</span>
      <span *ngIf="!value">false</span>
    </div>
  `,
  styleUrls: ['./boolean-yield.component.scss']
})
export class BooleanYieldComponent {
  @Input() value: boolean
}
