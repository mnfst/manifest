import { Component, Inject, Input, OnChanges } from '@angular/core'

import { ImageSize } from '../../../enums/image-size.enum'
import { CaseConfig } from '../../../interfaces/case-config.interface'

@Component({
  selector: 'case-image',
  templateUrl: './image.component.html',
  styleUrls: ['./image.component.scss']
})
export class ImageComponent implements OnChanges {
  @Input() path: string
  @Input() size: ImageSize = ImageSize.Thumbnail
  @Input() replacement = '/assets/images/avatar.svg'
  @Input() className = ''
  @Input() style = ''
  @Input() title = ''
  @Input() alt = 'image'

  absolutePath: string
  storagePath: string = this.config.storagePath

  constructor(@Inject('CASE_CONFIG_TOKEN') private config: CaseConfig) {}

  ngOnChanges() {
    // setTimeout to prevent 404 error on calling image too soon for API.
    setTimeout(() => {
      let sizePath: string

      // Adds extensions to images based on requested size.
      switch (this.size) {
        case ImageSize.Thumbnail:
          sizePath = `${this.path}-thumbnail.jpg`
          break
      }
      this.absolutePath = this.path
        ? `${this.storagePath}/${sizePath}`
        : this.replacement
    }, 150)
  }
}
