import { InputType } from '~shared/enums/input-type.enum'
import { PropType } from '~shared/enums/prop-type.enum'
import { YieldType } from '~shared/enums/yield-type.enum'

export type PropTypeCharacteristics = {
  input: InputType
  yield: YieldType
}

export const propTypeCharacteristicsRecord: Record<
  PropType,
  PropTypeCharacteristics
> = {
  [PropType.Text]: {
    input: InputType.Text,
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
  [PropType.Relation]: {
    input: InputType.Select,
    yield: YieldType.Link
  },
  [PropType.Currency]: {
    input: InputType.Currency,
    yield: YieldType.Currency
  },
  [PropType.Date]: {
    input: InputType.Date,
    yield: YieldType.Date
  },
  [PropType.Textarea]: {
    input: InputType.Textarea,
    yield: YieldType.Text
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
  [PropType.Enum]: {
    input: InputType.Select,
    yield: YieldType.Label | YieldType.ProgressBar
  },
  [PropType.File]: {
    input: InputType.FileUpload,
    yield: YieldType.Link
  },
  [PropType.Image]: {
    input: InputType.FileUpload,
    yield: YieldType.Link
  }
}
