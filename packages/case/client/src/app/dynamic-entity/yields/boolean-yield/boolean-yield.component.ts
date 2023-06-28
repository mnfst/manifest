import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-boolean-yield',
  template: `<div class="field">
    <input type="checkbox" class="checkbox" [checked]="value" />
  </div>`,
  styleUrls: ['./boolean-yield.component.scss']
})
export class BooleanYieldComponent {
  @Input() value: boolean
}
