import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges
} from '@angular/core'
import { CaseInput } from '../../../interfaces/case-input.interface'
import { ValidatorFn, FormGroup, FormBuilder, Validators } from '@angular/forms'

@Component({
  selector: 'case-toggle-input',
  templateUrl: './toggle-input.component.html',
  styleUrls: ['./toggle-input.component.scss']
})
export class ToggleInputComponent implements CaseInput, OnChanges {
  @Input() set initialValue(val: boolean) {
    this.checked = val
  }
  @Input() label: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<{ value: boolean }> = new EventEmitter()

  form: FormGroup
  checked: boolean
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

    this.form = this.formBuilder.group({
      toggle: [this.initialValue, this.validators || []]
    })
    this.required = this.validators.includes(Validators.required)
  }

  onChange() {
    this.checked = !this.checked
    this.valueChanged.emit({ value: this.checked })
  }
}
