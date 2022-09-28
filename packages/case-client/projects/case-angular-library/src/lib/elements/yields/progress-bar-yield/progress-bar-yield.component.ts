import { Component, Input, OnInit } from '@angular/core'

@Component({
  selector: 'case-progress-bar-yield',
  templateUrl: './progress-bar-yield.component.html',
  styleUrls: ['./progress-bar-yield.component.scss']
})
export class ProgressBarYieldComponent implements OnInit {
  @Input() progressValue: number
  @Input() totalValue: number
  @Input() tooltipText?: string

  totalValueArray: number[] = []

  ngOnInit() {
    for (let i = 1; i <= this.totalValue; i += 1) {
      this.totalValueArray.push(i)
    }
  }
}
