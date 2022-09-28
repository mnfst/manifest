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
  selector: 'case-image-input',
  templateUrl: './image-input.component.html',
  styleUrls: ['./image-input.component.scss']
})
export class ImageInputComponent implements CaseInput, OnChanges {
  @Input() label: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() resourceName: string
  @Input() initialValue: string
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  @ViewChild('imageInput', { static: false }) imageInputEl: ElementRef

  imagePath: string
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

    this.imagePath = this.initialValue
    this.required = this.validators.includes(Validators.required)
  }

  // Upload image and update value.
  imageInputEvent(imageInput: HTMLInputEvent) {
    this.loading = true
    this.fileContent = this.imageInputEl.nativeElement.files.item(0)
    this.uploadService
      .uploadImage(this.resourceName, this.fileContent)
      .subscribe(
        (res: { path: string }) => {
          this.loading = false
          this.imagePath = res.path
          this.valueChanged.emit(this.imagePath)
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
    delete this.imagePath
    this.valueChanged.emit(null)
  }
}
