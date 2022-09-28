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
  selector: 'case-radio-input',
  templateUrl: './radio-input.component.html',
  styleUrls: ['./radio-input.component.scss']
})
export class RadioInputComponent implements OnChanges, CaseInput {
  @Input() label: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() initialValue: string | number
  @Input() selectOptions: SelectOption[]
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<string | number> = new EventEmitter()

  form: FormGroup
  required: boolean

  constructor(private formBuilder: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Prevent value from being reset if showErrors changes.
    if (
      Object.keys(changes).length === 1 &&
      Object.keys(changes)[0] === 'showErrors'
    ) {
      return
    }

    this.form = this.formBuilder.group({
      radio: [null, this.validators || []]
    })

    if (this.initialValue) {
      setTimeout(() => {
        this.form.get('radio').setValue(this.initialValue)
      })
    }

    this.required = this.validators.includes(Validators.required)
  }

  select(item: SelectOption) {
    if (item.disabled) {
      return
    }
    this.selectOptions.forEach((i) => {
      i.selected = false
    })

    item.selected = !item.selected
    this.valueChanged.emit(item.value)
  }
}
