import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core'

import { environment } from '../../../../../environments/environment'
import { UploadService } from '../../services/upload.service'
import { FlashMessageService } from '../../services/flash-message.service'
import { PropertyManifest } from '@repo/types'
import { NgClass, NgIf } from '@angular/common'

@Component({
  selector: 'app-image-input',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './image-input.component.html'
})
export class ImageInputComponent {
  @Input() prop: PropertyManifest
  @Input() entitySlug: string
  @Input() value: string
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  @ViewChild('imageInput', { static: false }) imageInputEl: ElementRef

  storagePath: string = environment.storageBaseUrl

  fileContent: any
  loading: boolean

  constructor(
    private uploadService: UploadService,
    private flashMessageService: FlashMessageService
  ) {}

  // Upload image and update value.
  imageInputEvent() {
    this.loading = true
    this.fileContent = this.imageInputEl.nativeElement.files.item(0)
    this.uploadService
      .uploadImage({
        entity: this.entitySlug,
        property: this.prop.name,
        fileContent: this.fileContent
      })
      .then(
        (res: { path: string }) => {
          this.loading = false
          this.value = res.path
          this.valueChanged.emit(this.value)
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
    this.valueChanged.emit(null)
  }
}
