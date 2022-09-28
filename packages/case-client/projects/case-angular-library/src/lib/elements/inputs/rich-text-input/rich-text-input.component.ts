import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core'
import { ValidatorFn, Validators } from '@angular/forms'
import { ChangeEvent, CKEditor5 } from '@ckeditor/ckeditor5-angular'
import ClassicEditor from '@ckeditor/ckeditor5-build-classic'

import { CaseInput } from '../../../interfaces/case-input.interface'

@Component({
  selector: 'case-rich-text-input',
  templateUrl: './rich-text-input.component.html',
  styleUrls: ['./rich-text-input.component.scss']
})
export class RichTextInputComponent implements CaseInput, OnChanges {
  @Input() label: string
  @Input() initialValue: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  editor = ClassicEditor
  editorConfig: CKEditor5.Config

  content: string
  required: boolean

  ngOnChanges(changes: SimpleChanges) {
    // Prevent value from being reset if showErrors changes.
    if (
      Object.keys(changes).length === 1 &&
      Object.keys(changes)[0] === 'showErrors'
    ) {
      return
    }

    this.editorConfig = {
      toolbar: ['bold', 'italic', 'Link'],
      placeholder: this.placeholder
    }

    this.content = this.initialValue || ''
    this.required = this.validators.includes(Validators.required)
  }

  onChange(event: ChangeEvent) {
    this.content = event.editor.getData()
    this.valueChanged.emit(this.content)
  }
}
