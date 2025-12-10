export interface ValidatorUI {
  id: string
  label: string
  description: string
  input?: string
}

export const validators: ValidatorUI[] = [
  {
    id: 'isDefined',
    label: 'Is Defined',
    description: 'The field is defined (!== undefined, !== null)'
  },
  {
    id: 'isOptional',
    label: 'Is Optional',
    description:
      'The field is empty (=== null, === undefined) and if so, ignores all the validators on the property'
  },
  {
    id: 'equals',
    label: 'Equals',
    description: 'The field equals to',
    input: 'text'
  },
  {
    id: 'notEquals',
    label: 'Not Equals',
    description: 'The field is not equal to',
    input: 'text'
  },
  {
    id: 'isEmpty',
    label: 'Is Empty',
    description: 'The field can be empty'
  },
  {
    id: 'isNotEmpty',
    label: 'Is Not Empty',
    description: 'The field must not be empty'
  },
  {
    id: 'required',
    label: 'Required',
    description: 'The field must not be empty'
  },
  {
    id: 'isIn',
    label: 'Is In',
    description: 'The field is in an array of allowed values',
    input: 'text' // TODO: manage array input.
  },
  {
    id: 'isNotIn',
    label: 'Is Not In',
    description: 'The field not in an array of disallowed values',
    input: 'text' // TODO: manage array input.
  },
  {
    id: 'min',
    label: 'Minimum',
    description: 'The field minimum value or length allowed',
    input: 'number'
  },
  {
    id: 'max',
    label: 'Maximum',
    description: 'The field maximum value or length allowed',
    input: 'number'
  },
  {
    id: 'contains',
    label: 'Contains',
    description: 'The field contains the seed',
    input: 'text'
  },
  {
    id: 'notContains',
    label: 'Not Contains',
    description: 'The field does not contain the seed',
    input: 'text'
  },
  {
    id: 'isAlpha',
    label: 'Is Alpha',
    description: 'The field contains only letters (a-zA-Z)'
  },
  {
    id: 'isAlphanumeric',
    label: 'Is Alphanumeric',
    description: 'The field contains only letters and numbers'
  },
  {
    id: 'isAscii',
    label: 'Is ASCII',
    description: 'The field contains ASCII chars only'
  },
  {
    id: 'isEmail',
    label: 'Is Email',
    description: 'The field is an email'
  },
  {
    id: 'isJSON',
    label: 'Is JSON',
    description: 'The field is valid JSON'
  },
  {
    id: 'minLength',
    label: 'Min Length',
    description: 'The field length is not less than given number',
    input: 'number'
  },
  {
    id: 'maxLength',
    label: 'Max Length',
    description: 'The field length is not more than given number',
    input: 'number'
  },
  {
    id: 'matches',
    label: 'Matches Pattern',
    description: 'The field matches the pattern',
    input: 'text'
  }
]
