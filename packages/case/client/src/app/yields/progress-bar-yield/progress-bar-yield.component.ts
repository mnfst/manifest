import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { TruncatePipe } from '../../pipes/truncate.pipe'
import { EnumOptions } from '~shared/interfaces/property-options/enum-options.interface'

@Component({
  selector: 'app-progress-bar-yield',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  template: `
    <div
      class="is-flex is-align-items-center is-white-space-nowrap"
      [ngClass]="{ 'tooltip has-tooltip-left': value }"
      [attr.data-tooltip]="value"
    >
      <ng-container *ngFor="let enumOption of enumAsArray; let i = index">
        <span *ngIf="indexValue < i" class="is-size-7 has-text-weight-bold">
          X
        </span>
        <span *ngIf="indexValue >= i" class="is-size-7 has-text-weight-bold">
          o
        </span>
      </ng-container>
    </div>
  `,
  styleUrls: ['./progress-bar-yield.component.scss']
})
export class ProgressBarYieldComponent implements OnInit {
  @Input() value: string
  @Input() options: EnumOptions

  enumAsArray: string[] = []
  indexValue: number

  ngOnInit(): void {
    this.enumAsArray = Object.values(this.options.enum)
    this.indexValue = this.enumAsArray.indexOf(this.value)
  }
}
