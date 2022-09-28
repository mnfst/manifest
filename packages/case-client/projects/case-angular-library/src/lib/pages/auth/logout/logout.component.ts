import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '../../../services/auth.service'

@Component({
  template: 'NO UI TO BE FOUND HERE!'
})
export class LogoutComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.logout()
    this.router.navigate(['/login'])
  }
}
