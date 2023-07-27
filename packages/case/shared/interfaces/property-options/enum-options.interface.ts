import { PropertyOptions } from './property-options.interface'
import { YieldType } from '../../enums/yield-type.enum'

export interface EnumOptions extends PropertyOptions {
  enum: any
  display?: YieldType.ProgressBar | YieldType.Label
}
