import { Component, OnInit } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { Admin } from './typescript/interfaces/admin.interface'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  currentUser: Admin
  isCollapsed = false
  isLogin = true
  constructor(
    // private authService: AuthService,
    private router: Router // private flashMessageService: FlashMessageService,
  ) {}

  ngOnInit() {
    this.router.events.subscribe((routeChanged) => {
      if (routeChanged instanceof NavigationEnd) {
        window.scrollTo(0, 0)
        this.isLogin = routeChanged.url.includes('/auth/login')
        // if (this.isLogin) {
        //   this.currentUser = null
        // } else {
        //   if (!this.currentUser) {
        //     this.authService.me().then(
        //       (user) => {
        //         this.currentUser = user
        //       },
        //       (err) => {
        //         this.router.navigate(['/auth/login'])
        //         this.flashMessageService.error(
        //           'You must be logged in to view that page.'
        //         )
        //       }
        //     )
        //   }
        // }
      }
    })
  }
}
