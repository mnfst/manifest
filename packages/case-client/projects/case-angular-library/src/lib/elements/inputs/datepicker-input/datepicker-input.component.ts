import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'
import { FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms'
import {
  AngularMyDatePickerDirective,
  IMyDateModel
} from 'angular-mydatepicker'

import { CaseDatepickerComponent } from '../../../components/case-datepicker.component'
import { CaseInput } from '../../../interfaces/case-input.interface'

@Component({
  selector: 'case-datepicker-input',
  templateUrl: './datepicker-input.component.html',
  styleUrls: ['./datepicker-input.component.scss']
})
export class DatepickerInputComponent
  extends CaseDatepickerComponent
  implements CaseInput, OnChanges
{
  @ViewChild('dp') dp: AngularMyDatePickerDirective

  @Input() label: string
  @Input() helpText: string
  // Accepts YYYY-MM-DD formatted date
  @Input() initialValue: string
  @Input() placeholder: string
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  form: FormGroup
  required: boolean

  constructor(private formBuilder: FormBuilder) {
    super()
  }

  ngOnChanges(changes: SimpleChanges) {
    // Prevent value from being reset if showErrors changes.
    if (
      Object.keys(changes).length === 1 &&
      Object.keys(changes)[0] === 'showErrors'
    ) {
      return
    }

    this.form = this.formBuilder.group({
      date: [
        this.initialValue ? this.formatStandardDate(this.initialValue) : null,
        this.validators || []
      ]
    })
    this.required = this.validators.includes(Validators.required)
  }

  // Emits YYYY-MM-DD date or or null if date was removed.
  onDateChanged(event: IMyDateModel) {
    this.valueChanged.emit(
      event?.singleDate?.jsDate ? this.formatMyDatePickerDate(event) : null
    )
  }

  clear() {
    this.dp.clearDate()
    this.onDateChanged(null)
  }
}
