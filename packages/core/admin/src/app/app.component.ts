import { Component, OnDestroy, OnInit } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { AuthService } from './modules/auth/auth.service'
import { TOKEN_KEY } from '../constants'
import { Subscription } from 'rxjs'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  isLogin = true
  private currentUserSubscription: Subscription

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.router.events.subscribe((routeChanged) => {
      if (routeChanged instanceof NavigationEnd) {
        window.scrollTo(0, 0)
        this.isLogin =
          routeChanged.url.includes('/auth/login') ||
          routeChanged.url.includes('/auth/welcome')

        this.currentUserSubscription = this.authService.currentUser$.subscribe(
          (admin) => {
            if (!admin && localStorage.getItem(TOKEN_KEY)) {
              this.authService.loadCurrentUser().subscribe()
            }
          }
        )
      }
    })
  }

  ngOnDestroy(): void {
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe()
    }
  }
}
