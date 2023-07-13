import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

import { environment } from '../../../environments/environment'

@Component({
  selector: 'app-file-yield',
  standalone: true,
  imports: [CommonModule],
  template: `
    <a
      [href]="storagePath + value"
      target="_blank"
      download="download"
      *ngIf="value"
    >
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

  storagePath: string = environment.storagePath
}
