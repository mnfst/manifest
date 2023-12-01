import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { EnumPropertyOptions } from '~shared/interfaces/property-options/enum-property-options.interface'
import { TruncatePipe } from '../../pipes/truncate.pipe'

@Component({
  selector: 'app-label-yield',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  template: ` <span class="tag is-rounded is-color-{{ index }}" *ngIf="value">{{
      value
    }}</span>
    <span *ngIf="!value">-</span>`,
  styleUrls: ['./label-yield.component.scss']
})
export class LabelYieldComponent implements OnInit {
  @Input() value: string
  @Input() options: EnumPropertyOptions

  index: number

  ngOnInit(): void {
    this.index = Object.values(this.options.enum).indexOf(this.value)
  }
}
