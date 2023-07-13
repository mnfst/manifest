import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-file-yield',
  standalone: true,
  imports: [CommonModule],
  template: `
    <a [href]="value" target="_blank" download="download" *ngIf="value">
      <i class="icon icon-download"></i>
    </a>
    <a disabled *ngIf="!value">
      <i class="icon icon-download"></i>
    </a>
  `,
  styleUrls: ['./file-yield.component.scss']
})
export class FileYieldComponent {
  @Input() value: string
}
