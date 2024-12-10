import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms'

export function confirmPasswordValidator(
  passwordControlName: string
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control.parent
    if (!formGroup) return null

    const passwordControl = formGroup.get(passwordControlName)
    if (!passwordControl) return null

    const password = passwordControl.value
    const confirmPassword = control.value

    if (!confirmPassword || password !== confirmPassword) {
      return { confirmPasswordMismatch: true }
    }

    return null
  }
}
