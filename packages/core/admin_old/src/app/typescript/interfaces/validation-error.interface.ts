export interface ValidationError {
  target: Object // Object that was validated.
  property: string // Object's property that haven't pass validation.
  value: any // Value that haven't pass a validation.
  constraints?: {
    // Constraints that failed validation with error messages.
    [type: string]: string
  }
  children?: ValidationError[] // Contains all nested validation errors of the property
}
