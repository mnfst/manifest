import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'

import { TruncatePipe } from '../../pipes/truncate.pipe'

@Component({
  selector: 'app-progress-bar-yield',
  template: `
    <div
      class="is-flex is-align-items-center is-white-space-nowrap tooltip has-tooltip-left"
      [attr.data-tooltip]="value || 'Unknown'"
      class="is-color-{{ index }}"
    >
      <ng-container *ngFor="let option of values; let i = index">
        <span *ngIf="index >= i" class="bullet"> </span>
        <span class="bullet" *ngIf="index < i" class="bullet is-grey"> </span>
      </ng-container>
    </div>
  `,
  styleUrls: ['./progress-bar-yield.component.scss'],
  standalone: true,
  imports: [CommonModule, TruncatePipe]
})
export class ProgressBarYieldComponent implements OnInit {
  @Input() value: string
  @Input() values: string[] | any

  enumAsArray: string[] = []
  index: number

  ngOnInit(): void {
    this.index = this.values.indexOf(this.value)
  }
}
