import { Component, EventEmitter, Input, Output } from '@angular/core'
import { ValidatorFn } from '@angular/forms'

import { InputType } from '../../../enums/input-type.enum'
import { CaseInput } from '../../../interfaces/case-input.interface'
import { SelectOption } from '../../../interfaces/select-option.interface'

@Component({
  selector: 'case-input',
  templateUrl: './case-input.component.html',
  styleUrls: ['./case-input.component.scss']
})

// * Default CASE input wrapper that calls the other ones
export class CaseInputComponent implements CaseInput {
  // Common props.
  @Input() type: InputType
  @Input() properties: string[]
  @Input() label: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() showErrors: boolean
  @Input() readonly: boolean
  @Input() validators: ValidatorFn[] = []

  // Input specific props.
  @Input() initialValue: any
  @Input() searchResources: string[]
  @Input() resourceName: string
  @Input() selectOptions: SelectOption[]
  @Input() step: string
  @Input() accept: string
  @Input() min: number
  @Input() max: number
  @Input() maxSelectedItems: number
  @Input() searchParams: { [key: string]: string }
  @Input() copyDateFromOnDateTo = false
  @Input() secondPlaceholder: string
  @Input() required: boolean

  @Output() valueChanged: EventEmitter<any> = new EventEmitter()

  InputType = InputType

  // Generate a unique id for each input. Necessary to make "label -> input" link (click on label to focus input).
  uniqueId: string = Math.floor(Math.random() * 10000).toString()

  // Transmit information to parent.
  onValueChanged(event: any) {
    this.valueChanged.emit(event)
  }
}
