import { Component, Input, OnInit } from '@angular/core'

import { NgIf } from '@angular/common'
import { ImageSizesObject } from '@repo/types'
import { getSmallestImageSize } from '@repo/common'

@Component({
    selector: 'app-image-yield',
    imports: [NgIf],
    template: `
    <img [src]="image" alt="image" *ngIf="image" width="36" height="36" />
    <span *ngIf="!image">-</span>
  `
})
export class ImageYieldComponent implements OnInit {
  @Input() value: { [key: string]: string }
  @Input() sizes: ImageSizesObject | any
  @Input() label: string

  image: string

  ngOnInit(): void {
    if (this.value) {
      const smallestSize: string = getSmallestImageSize(this.sizes)
      this.image = this.value[smallestSize]
    }
  }
}
