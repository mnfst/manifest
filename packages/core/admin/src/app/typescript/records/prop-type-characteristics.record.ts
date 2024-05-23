import { PropType } from '@mnfst/types'
import { InputType } from '../enums/input-type.enum'
import { YieldType } from '../enums/yield-type.enum'

export type PropTypeCharacteristics = {
  input: InputType
  yield: YieldType
}

export const propTypeCharacteristicsRecord: Record<
  PropType,
  PropTypeCharacteristics
> = {
  [PropType.String]: {
    input: InputType.Text,
    yield: YieldType.Text
  },
  [PropType.Text]: {
    input: InputType.Textarea,
    yield: YieldType.Text
  },
  [PropType.Number]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.Link]: {
    input: InputType.Text,
    yield: YieldType.Link
  },
  [PropType.Money]: {
    input: InputType.Currency,
    yield: YieldType.Currency
  },
  [PropType.Date]: {
    input: InputType.Date,
    yield: YieldType.Date
  },
  [PropType.Email]: {
    input: InputType.Email,
    yield: YieldType.Email
  },
  [PropType.Boolean]: {
    input: InputType.Boolean,
    yield: YieldType.Boolean
  },
  [PropType.Password]: {
    input: InputType.Password,
    yield: YieldType.Text
  },
  [PropType.Choice]: {
    input: InputType.Select,
    yield: YieldType.Label | YieldType.ProgressBar
  },
  [PropType.Location]: {
    input: InputType.Location,
    yield: YieldType.Location
  }
}
