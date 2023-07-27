import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { TruncatePipe } from '../../pipes/truncate.pipe'
import { EnumOptions } from '~shared/interfaces/property-options/enum-options.interface'

@Component({
  selector: 'app-progress-bar-yield',
  template: `
    <div
      class="is-flex is-align-items-center is-white-space-nowrap tooltip has-tooltip-left"
      [attr.data-tooltip]="value || 'Unknown'"
    >
      <ng-container *ngFor="let enumOption of enumAsArray; let i = index">
        <span *ngIf="valueIndex >= i" class="is-size-7 has-text-weight-bold">
          x
        </span>
        <span *ngIf="valueIndex < i" class="is-size-7 has-text-weight-bold">
          -
        </span>
      </ng-container>
    </div>
  `,
  styleUrls: ['./progress-bar-yield.component.scss'],
  standalone: true,
  imports: [CommonModule, TruncatePipe]
})
export class ProgressBarYieldComponent implements OnInit {
  @Input() value: string
  @Input() options: EnumOptions

  enumAsArray: string[] = []
  valueIndex: number

  ngOnInit(): void {
    this.enumAsArray = Object.values(this.options.enum)
    this.valueIndex = this.enumAsArray.indexOf(this.value)
  }
}
