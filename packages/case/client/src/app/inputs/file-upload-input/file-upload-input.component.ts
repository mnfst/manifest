import { CommonModule } from '@angular/common'
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core'

import { PropertyDescription } from '../../../../../shared/interfaces/property-description.interface'
import { FileOptions } from '../../../../../shared/interfaces/property-options/file-options.interface'
import { FlashMessageService } from '../../services/flash-message.service'
import { UploadService } from '../../services/upload.service'

@Component({
  selector: 'app-file-upload-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload-input.component.html',
  styleUrls: ['./file-upload-input.component.scss']
})
export class FileUploadInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Input() value: string

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  @ViewChild('fileInput', { static: false }) fileInputEl: ElementRef

  // TODO: Manage storagePath
  storagePath: string = 'storage'

  filePath: string
  fileContent: any
  loading: boolean

  options: FileOptions

  constructor(
    private uploadService: UploadService,
    private flashMessageService: FlashMessageService
  ) {}

  ngOnInit() {
    this.options = this.prop.options as FileOptions
    // if (this.value !== undefined) {
    //   this.filePath = this.value
    // }
  }

  // Upload file and update value.
  fileInputEvent(event: any) {
    this.loading = true
    this.fileContent = this.fileInputEl.nativeElement.files.item(0)
    this.uploadService.upload(this.prop.propName, this.fileContent).then(
      (res: { path: string }) => {
        this.loading = false
        this.filePath = res.path
        this.valueChanged.emit(this.filePath)
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
    delete this.filePath
    this.valueChanged.emit(null)
  }
}
