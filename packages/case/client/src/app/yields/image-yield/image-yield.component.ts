import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { environment } from '../../../environments/environment'

@Component({
  selector: 'app-image-yield',
  standalone: true,
  imports: [CommonModule],
  template: `
    <figure class="image">
      <img
        [src]="imagePath || '/assets/images/image-default.svg'"
        [ngClass]="{ 'is-rounded': compact, 'is-large': !compact }"
      />
    </figure>
  `,
  styleUrls: ['./image-yield.component.scss']
})
export class ImageYieldComponent {
  @Input() value: { [key: string]: string }
  @Input() compact: boolean = false

  imagePath: string

  ngOnInit(): void {
    if (this.value) {
      this.imagePath =
        environment.storagePath + this.value[Object.keys(this.value)[0]]
    }
  }
}
