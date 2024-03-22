import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { TruncatePipe } from '../../../../common/pipes/truncate.pipe'

@Component({
  selector: 'app-text-yield',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  template: `
    <span *ngIf="compact">{{ value | truncate : 44 }}</span>
    <span *ngIf="!compact">{{ value }}</span>
    <span *ngIf="!value"> - </span>
  `,
  styleUrls: ['./text-yield.component.scss']
})
export class TextYieldComponent {
  @Input() value: string
  @Input() compact: boolean = true
}
