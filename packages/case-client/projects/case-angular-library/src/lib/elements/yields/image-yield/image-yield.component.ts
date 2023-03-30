import { Component, Inject, Input } from '@angular/core'

import { CaseConfig } from '../../../interfaces/case-config.interface'

@Component({
  selector: 'case-image-yield',
  templateUrl: './image-yield.component.html',
  styleUrls: ['./image-yield.component.scss']
})
export class ImageYieldComponent {
  @Input() image: string
  @Input() defaultImage = '/assets/images/avatar.svg'
  @Input() label: string

  storagePath: string = this.config.storagePath

  constructor(@Inject('CASE_CONFIG_TOKEN') private config: CaseConfig) {}
}
