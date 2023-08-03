import { PropertyOptions } from './property-options.interface'

export interface EnumOptions extends PropertyOptions {
  enum: any
  display?: 'label' | 'progress-bar'
}
