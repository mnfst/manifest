import { Component } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService } from '../../../services/auth.service'
import { FlashMessageService } from '../../../services/flash-message.service'

@Component({
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  providers: [AuthService]
})
export class ForgotPasswordComponent {
  form: FormGroup = this.formBuilder.group({
    email: ['', [Validators.email, Validators.required]]
  })

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private flashMessageService: FlashMessageService,
    private router: Router
  ) {}

  submit() {
    this.authService.sendResetPasswordEmail(this.form.value.email).subscribe(
      () => {
        this.flashMessageService.success(
          'Un email avec un lien de réinitialisation vous a été envoyé. Veuillez consulter votre boite mail.'
        )

        return this.router.navigate(['/'])
      },
      (err) => {
        this.flashMessageService.error(err.error.message)
        this.form.reset()
      }
    )
  }
}
