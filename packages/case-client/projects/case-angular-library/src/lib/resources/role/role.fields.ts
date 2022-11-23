import { InputType } from '../../enums/input-type.enum'
import { Field } from '../../interfaces/field.interface'

export const roleFields: Field[] = [
  {
    label: 'Identifier',
    property: 'name',
    inputType: InputType.Text,
    required: true
  },
  {
    label: 'Name',
    property: 'displayName',
    inputType: InputType.Text,
    required: true
  },
  {
    label: 'Homepage',
    helpText: 'Set the homepage for this role, e.g. /dashboard',
    property: 'homepagePath',
    inputType: InputType.Text
  },
  {
    hidden: true,
    label: 'Permissions',
    properties: {
      value: 'permissionIds'
    },
    selectOptions: [],
    inputType: InputType.MultiSelect,
    className: 'is-2'
  }
]
