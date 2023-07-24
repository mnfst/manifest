import { PropertyOptions } from './property-options.interface'
export interface EnumOptions extends PropertyOptions {
  // the enum property accepts any kind of enum.
  enum: any
  defaultValue?: any
  color?: any
  display: 'label' | 'progress-bar'
}
