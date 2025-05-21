import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Params, Router } from '@angular/router'

import { PropType } from '@repo/types'

import { AuthService } from '../../auth.service'
import { DEFAULT_ADMIN_CREDENTIALS } from '../../../../../constants'
import { ManifestService } from '../../../shared/services/manifest.service'

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: false
})
export class LoginComponent implements OnInit {
  appName: string

  suggestedEmail: string
  suggestedPassword: string

  PropType = PropType

  form: FormGroup

  constructor(
    private readonly authService: AuthService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private manifestService: ManifestService
  ) {}

  async ngOnInit(): Promise<void> {
    const isDbEmpty = await this.authService.isDbEmpty()

    if (isDbEmpty) {
      this.router.navigate(['/auth/welcome'])
    }

    // Get app name from manifest.
    this.manifestService.getAppName().then((name) => {
      this.appName = name
    })

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
