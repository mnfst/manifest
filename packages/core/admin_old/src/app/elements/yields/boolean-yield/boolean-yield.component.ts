import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-boolean-yield',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <span *ngIf="value">
        <i class="icon icon-check-circle has-text-success"></i>
      </span>
      <span *ngIf="!value"> - </span>
    </div>
  `,
  styleUrls: ['./boolean-yield.component.scss']
})
export class BooleanYieldComponent {
  @Input() value: boolean
}
