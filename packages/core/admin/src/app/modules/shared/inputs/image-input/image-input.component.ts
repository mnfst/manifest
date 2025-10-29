import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core'

import { UploadService } from '../../services/upload.service'
import { FlashMessageService } from '../../services/flash-message.service'
import { ImageSize, PropertyManifest } from '@repo/types'
import { NgClass, NgIf } from '@angular/common'
import { getSmallestImageSize } from '@repo/common'

@Component({
  selector: 'app-image-input',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './image-input.component.html'
})
export class ImageInputComponent implements OnInit {
  @Input() prop: PropertyManifest
  @Input() entitySlug: string
  @Input() value: { [key: string]: string }
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<{ [key: string]: string }> =
    new EventEmitter()

  @ViewChild('imageInput', { static: false }) imageInputEl: ElementRef

  loading: boolean
  displayedImage: string

  constructor(
    private uploadService: UploadService,
    private flashMessageService: FlashMessageService
  ) {}

  ngOnInit(): void {
    if (this.value) {
      const smallestSize: ImageSize | undefined = getSmallestImageSize(
        this.prop.options?.['sizes'] as ImageSize[]
      )

      this.displayedImage = this.value[smallestSize?.name]
    }
  }

  // Upload image and update value.
  imageInputEvent() {
    this.loading = true
    this.uploadService
      .uploadImage({
        entity: this.entitySlug,
        property: this.prop.name,
        fileContent: this.imageInputEl.nativeElement.files.item(0)
      })
      .then(
        (res: { [key: string]: string }) => {
          this.loading = false
          this.value = res

          // Sometimes the image is not available directly after upload. Waiting a bit works.
          setTimeout(() => {
            this.displayedImage = res[Object.keys(res)[0]]

            this.valueChanged.emit(this.value)
          }, 100)
        },
        () => {
          this.loading = false
          this.flashMessageService.error(
            'There was an error uploading your image.'
          )
        }
      )
  }

  removeFile() {
    delete this.value
    delete this.displayedImage
    this.valueChanged.emit(null)
  }
}
