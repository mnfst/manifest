import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { TruncatePipe } from '../../pipes/truncate.pipe'

@Component({
  selector: 'app-text-yield',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  template: `
    <span *ngIf="compact">{{ value | truncate: 25 }}</span>
    <span *ngIf="!compact">{{ value }}</span>
  `,
  styleUrls: ['./text-yield.component.scss']
})
export class TextYieldComponent {
  @Input() value: string
  @Input() compact: boolean = true
}
