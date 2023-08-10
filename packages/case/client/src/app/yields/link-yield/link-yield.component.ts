import { NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-link-yield',
  standalone: true,
  imports: [NgIf],
  template: ` <a [href]="value" target="_blank">{{ value }}</a>
    <span class="is-nowrap" *ngIf="!value"> - </span>`,
  styleUrls: ['./link-yield.component.scss']
})
export class LinkYieldComponent {
  @Input() value: string
}
