import { HttpErrorResponse } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'

import { PropType } from '../../../../../../shared/enums/prop-type.enum'
import { PropertyDescription } from '../../../../../../shared/interfaces/property-description.interface'

import { FlashMessageService } from '../../../services/flash-message.service'
import { AuthService } from '../../auth.service'
import { AppConfigService } from '../../../services/app-config.service'
import { AppConfig } from '../../../../../../shared/interfaces/app-config.interface'

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  appConfig: AppConfig
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
  defaultUser: any = {
    email: 'user1@case.app',
    password: 'case'
  }

  form: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required])
  })

  constructor(
    private readonly authService: AuthService,
    private router: Router,
    private flashMessageService: FlashMessageService,
    private appConfigService: AppConfigService
  ) {}

  ngOnInit(): void {
    this.appConfigService.appConfig.subscribe((res: AppConfig) => {
      this.appConfig = res

      if (!this.appConfig.production) {
        this.patchValue('email', this.defaultUser.email)
        this.patchValue('password', this.defaultUser.password)
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
