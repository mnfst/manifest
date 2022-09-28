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
import { SelectOption } from '../../../interfaces/select-option.interface'

@Component({
  selector: 'case-select-input',
  templateUrl: './select-input.component.html',
  styleUrls: ['./select-input.component.scss']
})
export class SelectInputComponent implements CaseInput, OnChanges {
  @Input() label: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() initialValue: string | number
  @Input() selectOptions: SelectOption[]
  @Input() readonly: boolean
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string
  @Input() required: boolean

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  form: FormGroup = this.formBuilder.group({
    select: ['null', this.validators || []]
  })

  constructor(private formBuilder: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges) {
    this.required =
      this.validators.includes(Validators.required) || this.required

    // If new select options are provided, reset form value if the previous value is not in the new options.
    if (
      changes.selectOptions &&
      !changes.selectOptions.firstChange &&
      !changes.selectOptions.currentValue
        .map((o) => o.value)
        .includes(this.form?.value.select)
    ) {
      this.form.get('select').setValue('null')
      this.valueChanged.emit('null')
    } else {
      if (this.initialValue) {
        setTimeout(() => {
          this.form.get('select').setValue(String(this.initialValue))
        }, 0)
      } else {
        setTimeout(() => {
          this.form.get('select').setValue('null')
        }, 0)
      }
    }
  }

  onSelect(newValue: string) {
    this.valueChanged.emit(newValue)
  }
}
