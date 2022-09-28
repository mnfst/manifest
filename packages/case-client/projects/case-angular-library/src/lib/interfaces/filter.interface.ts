import { InputType } from '../enums/input-type.enum'
import { ResourceDefinition } from './resource-definition.interface'
import { SelectOption } from './select-option.interface'

export interface Filter {
  label: string

  inputType: InputType

  // Property or properties changed by the filer.
  // Example: single property "lateInvoicesOnly" or multiple property {dateFrom: "startDateFrom", dateTo: "startDateTo"}
  property?: string
  properties?: { [key: string]: string }

  placeholder?: string
  secondPlaceholder?: string

  value?: any | { [key: string]: any }

  // Optional, for filters that cannot stay blank. Default false.
  required?: boolean

  // Display only filter.
  readonly?: boolean

  // CSS class name for the filter.
  className?: string

  // Input-specific props
  searchResources?: ResourceDefinition[]
  selectOptions?: SelectOption[] | (() => Promise<SelectOption[]>)
}
