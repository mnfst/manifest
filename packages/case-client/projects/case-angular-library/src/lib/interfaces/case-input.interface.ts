import { EventEmitter } from '@angular/core'
import { ValidatorFn } from '@angular/forms'

export interface CaseInput {
  label: string
  initialValue: any
  valueChanged: EventEmitter<any>
  showErrors: boolean
  validators: ValidatorFn[]

  // Optional
  placeholder?: string
  selectOptions?: any[]
  required?: boolean
}
