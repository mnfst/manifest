import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Params, Router } from '@angular/router'

import { PropType } from '../../../../../../shared/enums/prop-type.enum'

import { combineLatest } from 'rxjs'
import { AppConfig } from '../../../../../../shared/interfaces/app-config.interface'
import { AppConfigService } from '../../../services/app-config.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { AuthService } from '../../auth.service'

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  appConfig: AppConfig

  defaultUser: any = {
    email: 'admin@case.app',
    password: 'case'
  }
  suggestedEmail: string
  suggestedPassword: string

  PropType = PropType

  form: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required])
  })

  constructor(
    private readonly authService: AuthService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private flashMessageService: FlashMessageService,
    private appConfigService: AppConfigService
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.appConfigService.appConfig,
      this.activatedRoute.queryParams
    ]).subscribe(([appConfig, queryParams]: [AppConfig, Params]) => {
      this.appConfig = appConfig

      if (queryParams['email'].length>0) {
        this.suggestedEmail = queryParams['email']
      } else if (!this.appConfig.production) {
        this.suggestedEmail = this.defaultUser.email
      }

      if (queryParams['password'].length>0) {
        this.suggestedPassword = queryParams['password']
      } else if (!this.appConfig.production) {
        this.suggestedPassword = this.defaultUser.password
      }

      if (this.suggestedEmail) {
        this.patchValue('email', this.suggestedEmail)
      }

      if (this.suggestedPassword) {
        this.patchValue('password', this.suggestedPassword)
      }
    })
  }

  patchValue(controlName: string, value: string) {
    this.form.get(controlName)?.patchValue(value)
  }

  submit() {
    this.authService.login(this.form.value).then(
      (res) => {
        this.router.navigate(['/'])
      },
      (err: HttpErrorResponse) => {
        this.flashMessageService.error(
          err.status === 401
            ? `Error: Incorrect username or password.`
            : err.error.message
        )
      }
    )
  }
}
