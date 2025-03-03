import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Params, Router } from '@angular/router'

import { PropType } from '@repo/types'

import { AuthService } from '../../auth.service'
import { DEFAULT_ADMIN_CREDENTIALS } from '../../../../../constants'

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  suggestedEmail: string
  suggestedPassword: string

  PropType = PropType

  form: FormGroup

  constructor(
    private readonly authService: AuthService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(async (queryParams: Params) => {
      // Set suggested email and password from query params or default admin credentials.
      if (queryParams['email'] && queryParams['password']) {
        this.suggestedEmail = queryParams['email']
        this.suggestedPassword = queryParams['password']
      } else {
        if (await this.authService.isDefaultAdminExists()) {
          this.suggestedEmail = DEFAULT_ADMIN_CREDENTIALS.email
          this.suggestedPassword = DEFAULT_ADMIN_CREDENTIALS.password
        }
      }
      this.form = new FormGroup({
        email: new FormControl(this.suggestedEmail || '', [
          Validators.required,
          Validators.email
        ]),
        password: new FormControl(this.suggestedPassword || '', [
          Validators.required
        ])
      })

      // Redirect to register first admin if the database is empty.
      if (await this.authService.isDbEmpty()) {
        this.router.navigate(['/auth/welcome'])
      }
    })
  }

  patchValue(controlName: string, value: string) {
    this.form.get(controlName)?.patchValue(value)
  }

  submit() {
    this.authService.login(this.form.value).then(
      () => {
        this.router.navigate(['/'])
      },
      (err: HttpErrorResponse) => {
        alert(
          err.status === 401
            ? `Error: Incorrect username or password.`
            : err.error.message
        )
      }
    )
  }
}
