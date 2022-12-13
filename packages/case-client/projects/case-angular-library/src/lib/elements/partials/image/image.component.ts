import { Component, Inject, Input, OnChanges } from '@angular/core'

import { CaseConfig } from '../../../interfaces/case-config.interface'

@Component({
  selector: 'case-image',
  templateUrl: './image.component.html',
  styleUrls: ['./image.component.scss']
})
export class ImageComponent implements OnChanges {
  @Input() path: string
  @Input() size: string = 'thumbnail'
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
      sizePath = `${this.path}-${this.size}.jpg`

      this.absolutePath = this.path
        ? `${this.storagePath}/${sizePath}`
        : this.replacement
    }, 150)
  }
}
