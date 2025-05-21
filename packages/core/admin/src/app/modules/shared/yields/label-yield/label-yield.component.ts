import { NgIf } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'

@Component({
  selector: 'app-label-yield',
  imports: [NgIf],
  template: ` <span class="tag is-rounded is-color-{{ index }}" *ngIf="value">{{
      value
    }}</span>
    <span *ngIf="!value">-</span>`,
  styleUrls: ['./label-yield.component.scss']
})
export class LabelYieldComponent implements OnInit {
  @Input() value: string
  @Input() values: string[] | any
  index: number

  ngOnInit(): void {
    this.index = this.values.indexOf(this.value)
  }
}
