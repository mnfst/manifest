import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { environment } from '../../../environments/environment'

@Component({
  selector: 'app-image-yield',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img [src]="storagePath + value + '-thumbnail.jpg'" *ngIf="value" />
    <span *ngIf="!value">%% Default img</span>
  `,
  styleUrls: ['./image-yield.component.scss']
})
export class ImageYieldComponent {
  @Input() value: string

  storagePath: string = environment.storagePath
}
