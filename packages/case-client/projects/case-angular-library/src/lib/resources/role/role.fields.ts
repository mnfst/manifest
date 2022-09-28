import { InputType } from '../../enums/input-type.enum'
import { Field } from '../../interfaces/field.interface'

export const roleFields: Field[] = [
  {
    label: 'Identifiant',
    property: 'name',
    inputType: InputType.Text,
    required: true
  },
  {
    label: 'Nom',
    property: 'displayName',
    inputType: InputType.Text,
    required: true
  },
  {
    label: 'Homepage',
    helpText: 'L\'URL de la page d\'accueil de ce rôle (ex: "/projets").',
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
