import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { environment } from '../../../environments/environment'

@Component({
  selector: 'app-image-yield',
  standalone: true,
  imports: [CommonModule],
  template: `
    <figure class="image">
      <img
        [src]="
          storagePath + value + (compact ? '-thumbnail.jpg' : '-large.jpg')
        "
        [ngClass]="{ 'is-rounded': compact }"
        *ngIf="value"
      />
      <span *ngIf="!value">%% Default img</span>
    </figure>
  `,
  styleUrls: ['./image-yield.component.scss']
})
export class ImageYieldComponent {
  @Input() value: string
  @Input() compact: boolean = false

  storagePath: string = environment.storagePath
}
