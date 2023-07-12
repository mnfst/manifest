import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'

import { PropType } from '../../../../../../shared/enums/prop-type.enum'
import { PropertyDescription } from '../../../../../../shared/interfaces/property-description.interface'
import { FlashMessageService } from '../../../services/flash-message.service'
import { AuthService } from '../../auth.service'

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  fields: PropertyDescription[] = [
    {
      propName: 'email',
      label: 'Email',
      type: PropType.Email
    },
    {
      propName: 'password',
      label: 'Password',
      type: PropType.Password
    }
  ]

  form: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required])
  })

  redirectTo: string

  constructor(
    private readonly authService: AuthService,
    private router: Router,
    private flashMessageService: FlashMessageService,
    private activatedRoute: ActivatedRoute
  ) {}

  patchValue(controlName: string, value: string) {
    this.form.get(controlName)?.patchValue(value)
  }

  ngOnInit(): void {
    this.redirectTo = this.activatedRoute.snapshot?.queryParams?.['redirectTo']
  }

  submit() {
    this.authService.login(this.form.value).then((res) => {
      this.router.navigate([this.redirectTo || '/']),
        (err: HttpErrorResponse) => {
          this.flashMessageService.error(
            err.status === 401
              ? `Error: Incorrect username or password.`
              : err.error.message
          )
          this.form.reset()
        }
    })
  }
}
