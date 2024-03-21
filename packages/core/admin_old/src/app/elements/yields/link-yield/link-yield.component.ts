import { NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'
import { TruncatePipe } from '../../../../common/pipes/truncate.pipe'

@Component({
  selector: 'app-link-yield',
  standalone: true,
  imports: [NgIf, TruncatePipe],
  template: ` <a
      [href]="value"
      target="_blank"
      class="is-inline-flex is-align-items-center"
      *ngIf="value"
    >
      <i class="icon icon-external-link mr-1"></i>
      <span *ngIf="compact">{{ value | truncate : 44 }}</span>
      <span *ngIf="!compact">{{ value }}</span>
    </a>
    <span class="is-nowrap" *ngIf="!value"> - </span>`,
  styleUrls: ['./link-yield.component.scss']
})
export class LinkYieldComponent {
  @Input() value: string
  @Input() compact: boolean = true
}
