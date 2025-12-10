import { NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-number-yield',
  standalone: true,
  template: `<span class="is-nowrap" *ngIf="value !== null">
      {{ value }}
    </span>
    <span class="is-nowrap" *ngIf="value === null"> - </span> `,
  styleUrls: ['./number-yield.component.scss'],
  imports: [NgIf]
})
export class NumberYieldComponent {
  @Input() value: string
}
