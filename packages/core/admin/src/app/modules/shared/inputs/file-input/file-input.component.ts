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
import { NgClass, NgIf } from '@angular/common'

@Component({
  selector: 'app-file-input',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './file-input.component.html'
})
export class FileInputComponent {
  @Input() value: string
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  @ViewChild('fileInput', { static: false }) fileInputEl: ElementRef

  storageBaseUrl = environment.storageBaseUrl

  fileContent: any
  required: boolean
  loading: boolean

  constructor(
    private uploadService: UploadService,
    private flashMessageService: FlashMessageService
  ) {}

  /**
   * Handle the file input event.
   *
   *
   */
  async onFileInputEvent(): Promise<void> {
    this.loading = true
    this.fileContent = this.fileInputEl.nativeElement.files.item(0)
    return this.uploadService
      .uploadFile({
        entity: 'file', // TODO: Get entity and prop from parent component.
        property: 'file',
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
            'There was an error uploading your file.'
          )
        }
      )
  }

  removeFile() {
    delete this.value
    this.valueChanged.emit(null)
  }
}
