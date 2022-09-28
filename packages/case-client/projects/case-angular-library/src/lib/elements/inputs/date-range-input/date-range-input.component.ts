import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'
import { FormBuilder, FormGroup, ValidatorFn } from '@angular/forms'
import {
  AngularMyDatePickerDirective,
  IMyDateModel
} from 'angular-mydatepicker'

import { CaseDatepickerComponent } from '../../../components/case-datepicker.component'
import { CaseInput } from '../../../interfaces/case-input.interface'

@Component({
  selector: 'case-date-range-input',
  templateUrl: './date-range-input.component.html',
  styleUrls: ['./date-range-input.component.scss']
})
export class DateRangeInputComponent
  extends CaseDatepickerComponent
  implements CaseInput, OnChanges
{
  @ViewChild('dp1') dp1: AngularMyDatePickerDirective
  @ViewChild('dp2') dp2: AngularMyDatePickerDirective

  @Input() label: string
  @Input() helpText: string
  // Accepts YYYY-MM-DD formatted dates
  @Input() initialValue: { dateFrom: string; dateTo: string }
  @Input() placeholder: string
  @Input() secondPlaceholder: string
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string
  @Input() copyDateFromOnDateTo: boolean

  @Output() valueChanged: EventEmitter<{
    dateFrom: string
    dateTo: string
  }> = new EventEmitter()

  outputValues: { dateFrom: string; dateTo: string } = {
    dateFrom: null,
    dateTo: null
  }

  form: FormGroup = this.formBuilder.group({
    dateFrom: null,
    dateTo: null
  })

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

    if (this.initialValue) {
      this.form.setValue({
        dateFrom: this.initialValue.dateFrom
          ? this.formatStandardDate(this.initialValue.dateFrom)
          : null,
        dateTo: this.initialValue.dateTo
          ? this.formatStandardDate(this.initialValue.dateTo)
          : null
      })

      this.outputValues = {
        dateFrom: this.initialValue.dateFrom || null,
        dateTo: this.initialValue.dateTo || null
      }
    }
  }

  // Emits YYYY-MM-DD date or or null if date was removed.
  onDateChanged(event: IMyDateModel, propName: string) {
    const newDate: string = event?.singleDate?.jsDate
      ? this.formatMyDatePickerDate(event)
      : null

    this.outputValues[propName] = newDate
    this.form.get(propName).setValue(newDate)

    if (
      this.copyDateFromOnDateTo &&
      this.outputValues.dateFrom &&
      !this.outputValues.dateTo
    ) {
      this.form.patchValue({
        dateTo: this.formatStandardDate(newDate)
      })

      this.outputValues.dateTo = newDate
    }

    this.valueChanged.emit(this.outputValues)
  }

  clear(datepickerName: string) {
    this.onDateChanged(null, datepickerName)
  }
}
