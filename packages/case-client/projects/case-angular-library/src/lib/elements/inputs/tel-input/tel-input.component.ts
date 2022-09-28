import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core'
import { FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms'

import { CaseInput } from '../../../interfaces/case-input.interface'

@Component({
  selector: 'case-tel-input',
  templateUrl: './tel-input.component.html',
  styleUrls: ['./tel-input.component.scss']
})
export class TelInputComponent implements OnChanges, CaseInput {
  @Input() label: string
  @Input() initialValue: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  telForm: FormGroup
  required: boolean

  constructor(private formBuilder: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges) {
    // Prevent value from being reset if showErrors changes.
    if (
      Object.keys(changes).length === 1 &&
      Object.keys(changes)[0] === 'showErrors'
    ) {
      return
    }

    this.telForm = this.formBuilder.group({
      text: [this.initialValue || null, this.validators]
    })
    this.required = this.validators.includes(Validators.required)
  }

  onChange(newValue: string) {
    this.valueChanged.emit(newValue)
  }
}
