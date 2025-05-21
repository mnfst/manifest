import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'

import { AuthService } from '../../auth.service'

@Component({
    template: 'NO UI TO BE FOUND HERE!',
    standalone: false
})
export class LogoutComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.logout()
    this.router.navigate(['/', 'auth', 'login'])
  }
}
