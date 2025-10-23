import { Component, OnDestroy, OnInit } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { AuthService } from './modules/auth/auth.service'
import { EMPTY_MANIFEST_NAME, TOKEN_KEY } from '../constants'
import { Subscription } from 'rxjs'
import { VersionService } from './modules/shared/services/version.service'
import { ManifestService } from './modules/shared/services/manifest.service'
import { AppManifest } from '../../../types/src'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  isLogin = true
  private currentUserSubscription: Subscription
  appManifest: AppManifest
  newVersionAvailable: boolean = false
  latestVersion: string = ''

  constructor(
    private authService: AuthService,
    private manifestService: ManifestService,
    private versionService: VersionService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.currentUserSubscription = this.authService.currentUser$.subscribe(
      (admin) => {
        if (!admin && localStorage.getItem(TOKEN_KEY)) {
          this.authService.loadCurrentUser().subscribe()
        }
      }
    )

    this.router.events.subscribe((routeChanged) => {
      if (routeChanged instanceof NavigationEnd) {
        window.scrollTo(0, 0)
        this.isLogin =
          routeChanged.url.includes('/auth/login') ||
          routeChanged.url.includes('/auth/welcome')
      }
    })

    this.appManifest = await this.manifestService.getManifest()

    if (this.appManifest.name === EMPTY_MANIFEST_NAME) {
      this.router.navigate(['/onboarding'])
    }

    // this.checkForUpdates()
  }

  ngOnDestroy(): void {
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe()
    }
  }

  checkForUpdates(): void {
    this.versionService
      .checkForUpdates({
        currentVersion: this.appManifest.manifestVersion,
        currentEnv: this.appManifest.environment,
        disableTelemetry: this.appManifest.disableTelemetry || false
      })
      .then((result) => {
        this.newVersionAvailable = result.isUpdateAvailable
        this.latestVersion = result.latestVersion
      })
      .catch((error) => {
        console.error('Error checking for updates:', error)
      })
  }
}
