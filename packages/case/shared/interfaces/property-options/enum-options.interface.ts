import { PropertyOptions } from './property-options.interface'
import { YieldType } from '../../enums/yield-type.enum'

export interface EnumOptions extends PropertyOptions {
  // the enum property accepts any kind of enum.
  enum: any
  display?: YieldType.ProgressBar | YieldType.Label
}
