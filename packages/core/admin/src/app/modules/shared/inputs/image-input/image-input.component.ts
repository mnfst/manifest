import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core'

import { environment } from '../../../../../environments/environment'
import { UploadService } from '../../services/upload.service'
import { FlashMessageService } from '../../services/flash-message.service'
import { ImageSizesObject, PropertyManifest } from '@repo/types'
import { NgClass, NgIf } from '@angular/common'
import { getSmallestImageSize } from '../../../../../../../helpers/src'

@Component({
  selector: 'app-image-input',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './image-input.component.html'
})
export class ImageInputComponent implements OnInit {
  @Input() prop: PropertyManifest
  @Input() entitySlug: string
  @Input() value: ImageSizesObject
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<ImageSizesObject> = new EventEmitter()

  @ViewChild('imageInput', { static: false }) imageInputEl: ElementRef

  loading: boolean
  displayedImage: string

  constructor(
    private uploadService: UploadService,
    private flashMessageService: FlashMessageService
  ) {}

  ngOnInit(): void {
    if (this.value) {
      const smallestSize: string = getSmallestImageSize(
        this.prop.options?.['sizes'] as ImageSizesObject
      )

      this.displayedImage = `${environment.storageBaseUrl}/${this.value[smallestSize]}`
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
        (res: ImageSizesObject) => {
          this.loading = false
          this.value = res

          // Sometimes the image is not available directly after upload. Waiting a bit works.
          setTimeout(() => {
            this.displayedImage = `${environment.storageBaseUrl}/${res[Object.keys(res)[0]]}`

            this.valueChanged.emit(this.value)
          }, 100)
        },
        (err) => {
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
