import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
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
  @Input() values: any | string[]
  index: number

  ngOnInit(): void {
    this.index = this.values.indexOf(this.value)
  }
}
