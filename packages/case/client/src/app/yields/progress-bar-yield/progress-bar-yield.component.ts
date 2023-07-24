import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { TruncatePipe } from '../../pipes/truncate.pipe'
import { EnumOptions } from '~shared/interfaces/property-options/enum-options.interface'

@Component({
  selector: 'app-progress-bar-yield',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  template: `
    <div class="progress-bar">
      <span
        *ngFor="
          let option of options.enum | keyvalue;
          index as i;
          first as isFirst;
          count as count
        "
        class="is-success"
      >
        <span *ngIf="isFirst">o</span>
        <span *ngIf="!isFirst">{{}}</span>
      </span>
    </div>
  `,
  styleUrls: ['./progress-bar-yield.component.scss']
})
export class ProgressBarYieldComponent implements OnInit {
  @Input() value: string
  @Input() options: EnumOptions
  isAchieved: boolean

  ngOnInit(): void {
    let enumKey = Object.keys(this.options.enum)[
      Object.values(this.options.enum).indexOf(this.value)
    ]
    console.log(this.value)
    console.log(enumKey)
  }
}
