import { ValidatorFn } from '@angular/forms'

import { InputType } from '../enums/input-type.enum'
import { ResourceDefinition } from './resource-definition.interface'
import { SelectOption } from './select-option.interface'

export interface Field {
  // Optional unique identifier if needed to add a FieldSpecialRule on it.
  id?: string

  property?: string
  properties?: { [key: string]: string }

  label: string
  inputType: InputType

  placeholder?: string
  secondPlaceholder?: string
  helpText?: string
  hidden?: boolean
  className?: string

  required?: boolean

  readonly?: boolean

  // Optional validators for fields.
  validators?: ValidatorFn[]
  createValidators?: ValidatorFn[]
  editValidators?: ValidatorFn[]

  // Sometimes we are sending the field data as a property but we fetch it as a different prop,usually for relations
  // Ex: we send as user.positionId but we get it as user.position.id. The key is the item property
  // and the value is the real path to that value.
  retrievedItemProperties?: { [key: string]: string }

  // In order to set defined values on form generation, we can chose between a soft option "initialValue" that adds a value
  // if no item value is available, or a force option "forcedValue" that overrides existing values.
  forcedValue?: any | { [key: string]: any }
  initialValue?:
    | any
    | { [key: string]: any }
    | (() => Promise<any | { [key: string]: any }>)

  // The current user permission needed to render the field.
  permission?: string

  // Input-specific
  selectOptions?: SelectOption[] | (() => Promise<SelectOption[]>)
  searchResources?: ResourceDefinition[]
  searchParams?: { [key: string]: string }
  maxSelectedItems?: number
  min?: number
  max?: number
  copyDateFromOnDateTo?: boolean

  // Function to trigger on value change. The other fields are available in the "allFields"  optional param.
  onChange?: (
    newValue: any | { [key: string]: any },
    allFields?: Field[]
  ) => void
}
