import { Component } from '@angular/core'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  // currentUser: User
  // isCollapsed = false
  // isLogin = true
  // constructor(
  //   // private authService: AuthService,
  //   // private router: Router,
  //   // private flashMessageService: FlashMessageService,
  //   // private appConfigService: AppConfigService
  // ) {}
  // ngOnInit() {
  //   this.router.events.subscribe((routeChanged) => {
  //     if (routeChanged instanceof NavigationEnd) {
  //       window.scrollTo(0, 0)
  //       this.isLogin = routeChanged.url.includes('/auth/login')
  //       if (this.isLogin) {
  //         this.currentUser = null
  //       } else {
  //         if (!this.currentUser) {
  //           this.authService.me().then(
  //             (user) => {
  //               this.currentUser = user
  //             },
  //             (err) => {
  //               this.router.navigate(['/auth/login'])
  //               this.flashMessageService.error(
  //                 'You must be logged in to view that page.'
  //               )
  //             }
  //           )
  //         }
  //       }
  //     }
  //   })
  //   this.appConfigService.getAppConfig().then((res: AppConfig) => {
  //     this.appConfigService.appConfig.next(res)
  //   })
  // }
}
