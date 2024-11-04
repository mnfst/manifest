import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { PropType } from '@repo/types'
import { confirmPasswordValidator } from '../../utlis/confirm-password-validator'
import { AuthService } from '../../auth.service'
import { Router } from '@angular/router'
import { FlashMessageService } from '../../../shared/services/flash-message.service'

@Component({
  selector: 'app-register-first-admin',
  templateUrl: './register-first-admin.component.html',
  styleUrl: './register-first-admin.component.scss'
})
export class RegisterFirstAdminComponent implements OnInit {
  form: FormGroup
  PropType = PropType

  constructor(
    private authService: AuthService,
    private router: Router,
    private flashMessageService: FlashMessageService
  ) {}

  ngOnInit(): void {
    this.form = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required]),
      confirmPassword: new FormControl('', [
        Validators.required,
        confirmPasswordValidator('password')
      ])
    })
  }

  /**
   * Patch value to the form
   *
   * @param controlName
   * @param value
   *
   * @returns void
   */
  patchValue(controlName: string, value: string) {
    this.form.get(controlName)?.patchValue(value)
  }

  /**
   * Submit the form
   */
  async submit(): Promise<void> {
    const token: string = await this.authService.signup(this.form.value)

    if (!token) {
      return this.flashMessageService.error('Error: Failed to register')
    }

    this.flashMessageService.success(
      'Welcome! You have successfully registered as an admin.'
    )

    this.router.navigate(['/'])
  }
}
