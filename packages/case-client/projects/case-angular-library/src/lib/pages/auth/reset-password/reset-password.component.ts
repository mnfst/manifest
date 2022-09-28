import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService } from '../../../services/auth.service'
import { FlashMessageService } from '../../../services/flash-message.service'

@Component({
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup = this.formBuilder.group({
    password: ['', Validators.required],
    token: ['', Validators.required]
  })

  constructor(
    private formBuilder: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private flashMessageService: FlashMessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.form.controls.token.setValue(
      this.activatedRoute.snapshot.queryParams.token
    )
  }

  submit() {
    this.authService
      .resetPassword(this.form.value.password, this.form.value.token)
      .subscribe(
        () => {
          this.flashMessageService.success(
            `Votre mot de passe a bien été réinitialisé, veuillez vous connecter à l'application`
          )

          return this.router.navigate(['/login'])
        },
        (err) => {
          this.flashMessageService.error(err.error.message)
          this.form.reset()
        }
      )
  }
}
