import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { PropertyDescription } from '../../../../../shared/interfaces/property-description.interface'
import { UploadService } from '../../services/upload.service'
import { FlashMessageService } from '../../services/flash-message.service'
import { environment } from '../../../environments/environment'

@Component({
  selector: 'app-image-upload-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-upload-input.component.html',
  styleUrls: ['./image-upload-input.component.scss']
})
export class ImageUploadInputComponent {
  @Input() prop: PropertyDescription
  @Input() value: string

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  @ViewChild('imageInput', { static: false }) imageInputEl: ElementRef

  storagePath: string = environment.storagePath

  imagePath: string
  fileContent: any
  loading: boolean

  constructor(
    private uploadService: UploadService,
    private flashMessageService: FlashMessageService
  ) {}

  // Upload image and update value.
  imageInputEvent(event: any) {
    this.loading = true
    this.fileContent = this.imageInputEl.nativeElement.files.item(0)
    this.uploadService.uploadImage(this.prop.propName, this.fileContent).then(
      (res: { path: string }) => {
        this.loading = false
        this.imagePath = res.path
        this.valueChanged.emit(this.imagePath)
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
    delete this.imagePath
    this.valueChanged.emit(null)
  }
}
