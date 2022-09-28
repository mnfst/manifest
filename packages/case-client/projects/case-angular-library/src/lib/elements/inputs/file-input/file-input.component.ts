import {
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'
import { ValidatorFn, Validators } from '@angular/forms'

import { CaseConfig } from '../../../interfaces/case-config.interface'
import { CaseInput } from '../../../interfaces/case-input.interface'
import { HTMLInputEvent } from '../../../interfaces/html-input-event.interface'
import { FlashMessageService } from '../../../services/flash-message.service'
import { UploadService } from '../../../services/upload.service'

@Component({
  selector: 'case-file-input',
  templateUrl: './file-input.component.html',
  styleUrls: ['./file-input.component.scss']
})
export class FileInputComponent implements CaseInput, OnChanges {
  @Input() label: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() resourceName: string
  @Input() initialValue: string
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string
  @Input() accept = '*'

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  @ViewChild('fileInput', { static: false }) fileInputEl: ElementRef

  filePath: string
  storagePath: string = this.config.storagePath

  fileContent: any
  required: boolean
  loading: boolean

  constructor(
    private uploadService: UploadService,
    private flashMessageService: FlashMessageService,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    // Prevent value from being reset if showErrors changes.
    if (
      Object.keys(changes).length === 1 &&
      Object.keys(changes)[0] === 'showErrors'
    ) {
      return
    }

    this.filePath = this.initialValue || null
    this.required = this.validators.includes(Validators.required)
  }

  // Upload file and update value.
  fileInputEvent(fileInput: HTMLInputEvent) {
    this.loading = true
    this.fileContent = this.fileInputEl.nativeElement.files.item(0)
    this.uploadService
      .uploadFile(this.resourceName, this.fileContent)
      .subscribe(
        (res: { path: string }) => {
          this.loading = false
          this.filePath = res.path
          this.valueChanged.emit(this.filePath)
        },
        (err) => {
          this.loading = false
          this.flashMessageService.error(
            `Une erreur à eu lieu lors de l'envoi du fichier`
          )
        }
      )
  }

  removeFile() {
    delete this.filePath
    this.valueChanged.emit(null)
  }
}
