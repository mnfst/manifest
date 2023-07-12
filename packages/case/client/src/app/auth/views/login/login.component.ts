import { HttpErrorResponse } from '@angular/common/http'
import { Component } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'

import { PropType } from '../../../../../../shared/enums/prop-type.enum'
import { AppConfig } from '../../../../../../shared/interfaces/app-config.interface'
import { PropertyDescription } from '../../../../../../shared/interfaces/property-description.interface'
import { AppConfigService } from '../../../services/app-config.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { AuthService } from '../../auth.service'

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
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
  appConfig: AppConfig

  constructor(
    private readonly authService: AuthService,
    private router: Router,
    private flashMessageService: FlashMessageService,
    appConfigService: AppConfigService
  ) {
    appConfigService.loadAppConfig().subscribe((res) => {
      console.log(res)
      this.appConfig = res
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
