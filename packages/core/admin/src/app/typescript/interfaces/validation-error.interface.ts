export interface ValidationError {
  target: Object // Object that was validated.
  property: string // Object's property that failed validation.
  value: any // Value that failed validation.
  constraints?: {
    // Constraints that failed validation with error messages.
    [type: string]: string
  }
  children?: ValidationError[] // Contains all nested validation errors of the property
}
