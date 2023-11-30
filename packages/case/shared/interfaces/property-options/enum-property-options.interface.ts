import { PropertyOptions } from './property-options.interface'

export interface EnumPropertyOptions extends PropertyOptions {
  enum: any
  display?: 'label' | 'progress-bar'
}
